# Moving the database to another project or host

Written immediately after doing it for real — Supabase Tokyo (`ap-northeast-1`)
to Supabase Mumbai (`ap-south-1`), August 2026 — so the gotchas below are ones
that actually happened, not ones that might.

The same procedure covers the move people usually care about more: **Supabase
Cloud to a self-hosted Postgres**. Nothing here is Supabase-specific except the
storage section and the `auth` schema, and both are called out.

---

## When you need this

- Changing region. Supabase fixes a project's region at creation; there is no
  setting to change it, so "changing region" means "new project plus this
  document".
- Leaving Supabase Cloud for your own infrastructure.
- Cloning production into a staging project.

## The shape of it

A database move is **three separate migrations**, and conflating them is the
usual source of pain:

1. **Schema** — tables, policies, functions, triggers.
2. **Data** — the rows.
3. **Files** — anything in object storage. *Not in Postgres.* See below.

Do them in that order, and verify between each.

---

## 1. Schema

Do not dump the schema. Replay the migrations:

```bash
npx supabase link --project-ref <new-ref>
npx supabase db push
```

This is better than a schema dump because it proves your migration chain still
builds a working database from nothing. A dump would happily preserve drift and
hand-applied changes you have forgotten about.

### Duplicate migration numbers will stop you

`db push` keys each migration by the number at the front of its filename, in a
table with that column as the primary key. Two files starting `025_` produce:

```
duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(025) already exists.
```

It fails safely — the migration's statements and the tracking insert share a
transaction, so the offender rolls back rather than half-applying — but you
must fix it before continuing.

To fix: renumber the *later-added* file to a free number at the end, but first
check nothing depends on it running where it used to. We moved
`025_presence_offline` to `080` and `044_contact_dob` to `081` after confirming
no later migration references `member_presence`, `touch_presence` or
`date_of_birth`. We deliberately did **not** move `044_instagram_channel`,
because `046_instagram_oauth` and `076_meta_unified_connect` need its tables.

```bash
# find duplicates before you start
ls -1 supabase/migrations/*.sql | sed 's|.*/||;s/_.*//' | sort | uniq -d
```

Timestamped filenames (`20260805143000_name.sql`) are unique by construction.
Consider switching to them for anything new.

---

## 2. Data

### If you can install PostgreSQL client tools, use `pg_dump`

It is the right tool, it is fast, and it is what you will use on a real server.
`supabase db dump` wraps it but runs it **inside Docker**, so it needs Docker
Desktop even when the database is remote.

### Otherwise

`scripts/migrate-db.mjs` does the same job through the `pg` npm package — no
system install. Fine for small and medium datasets; for millions of rows, find
a machine with `pg_dump`.

```bash
# .env.local
OLD_DB_URL=postgresql://postgres:...@db.<old-ref>.supabase.co:5432/postgres
NEW_DB_URL=postgresql://postgres:...@db.<new-ref>.supabase.co:5432/postgres

node --env-file=.env.local scripts/migrate-db.mjs --dry-run   # always first
node --env-file=.env.local scripts/migrate-db.mjs
```

It copies the intersection of columns present on both sides, so a source older
than the target simply lets new columns take their defaults. Every insert is
`ON CONFLICT DO NOTHING`, so a partial run can be repeated.

### Connection strings

Take the URI straight from the dashboard and **do not re-encode it**. It
arrives already percent-encoded; encoding it again turns `%23` into `%2523` and
you get `password authentication failed`, which looks like a wrong password and
sends you round in circles.

Two traps worth knowing:

- The **database** password is not your Supabase **account** password. It is
  set at project creation and shown once. Reset it under
  Settings → Database if you do not have it.
- `SUPABASE_DB_PASSWORD` in your environment **overrides** the password in a
  `--db-url`. If you have it set for one project and are connecting to another,
  unset it for that command.

### What not to copy

| Table | Why |
|---|---|
| `public.billing_plans` | seeded by a migration on the target; copying collides |
| `storage.buckets` | same |
| `storage.objects` | metadata only — see the files section |
| `auth.sessions`, `auth.refresh_tokens`, `auth.flow_state` | expire anyway; stale rows cause confusion, not convenience |
| `*_migrations` tables | owned by the tooling |

### What you must copy for logins to survive

`auth.users` and `auth.identities`. The first holds password hashes, the second
holds OAuth identity links. Miss either and people are locked out.

**Check the auth schema versions match** before relying on this:

```sql
select count(*) from auth.schema_migrations;   -- run on both, compare
```

Equal counts mean the same auth schema shape and a safe copy. Different counts
mean Supabase has changed the schema between your two projects — stop and read
the release notes before continuing.

---

## 3. Files

**Object storage is not in the database.** `storage.objects` holds metadata —
name, size, owner — while the bytes live in the storage service. Copying that
table gives you records pointing at files the new project does not have, which
shows up as broken images rather than as an error.

Either migrate files deliberately through the storage API (list, download,
re-upload), or skip them and accept the loss. `migrate-db.mjs` skips them and
says so.

We skipped ours because uploads were moving to Cloudflare R2 anyway — see
`src/lib/storage/r2.ts`.

---

## Gotchas we actually hit

### `jsonb` arrays break on a round trip

`pg` reads JSON columns into JavaScript values and then guesses how to send
them back. Objects it stringifies correctly. **Arrays it converts to a Postgres
array literal** — `{a,b}` — and the server rejects it:

```
invalid input syntax for type json
```

So a `jsonb` column holding `["a","b"]` fails while one holding `{"a":1}`
succeeds. You will not notice until you reach a table that has one.

Fix: look up each column's type on the target and `JSON.stringify` anything
`json` or `jsonb` yourself. `migrate-db.mjs` does this in `encodeValue`.

### `session_replication_role = replica` may do nothing

The standard trick for importing without worrying about foreign key order is to
suspend constraint and trigger enforcement:

```sql
set session_replication_role = replica;
```

**On Supabase this appeared to have no effect** — the command succeeded, but a
`BEFORE INSERT` trigger fired anyway. Managed Postgres commonly restricts it.

Our import still worked, but *by luck*: alphabetical table order happened to
satisfy the foreign keys (`accounts` before `profiles`, `conversations` before
`messages`). **That luck does not scale.** Before a real migration, either
verify suspension actually works on your target, or import in an explicit
dependency order.

Test it directly rather than assuming:

```sql
set session_replication_role = replica;
show session_replication_role;   -- did it stick?
```

### Denormalised columns filled by triggers

`messages.account_id` (migration 078) does not exist on a source older than
that migration, is `NOT NULL` on the target, and is normally filled by a
trigger. If you *do* manage to suspend triggers, the insert then fails the
`NOT NULL`.

The sequence that works either way:

```sql
alter table public.messages alter column account_id drop not null;
-- import
update public.messages m set account_id = c.account_id
  from public.conversations c
 where c.id = m.conversation_id and m.account_id is null;
alter table public.messages alter column account_id set not null;
```

If the trigger fired, the backfill reports 0 rows and does no harm.

### Trigger-maintained metadata needs re-deriving

Migration 079 mirrors account context into `auth.users.raw_app_meta_data` via
triggers on `profiles` and `accounts`. An import that bypasses those triggers —
or that inserts profiles before the users exist — leaves the metadata unset,
and every API request silently falls back to the slower query path.

```sql
select sync_user_app_metadata(user_id) from profiles where user_id is not null;
```

---

## Verifying

Counts alone are not enough. Check the *relationships*:

```sql
select 'auth.users' as t, count(*)::text as n from auth.users
union all select 'profiles', count(*)::text from profiles
union all select 'messages', count(*)::text from messages
-- integrity, not just volume:
union all select 'messages missing account_id',
       count(*)::text from messages where account_id is null
union all select 'messages with WRONG account_id',
       count(*)::text from messages m join conversations c on c.id = m.conversation_id
        where m.account_id is distinct from c.account_id
union all select 'users missing app_metadata',
       count(*)::text from auth.users where raw_app_meta_data->>'account_id' is null
union all select 'orphan profiles',
       count(*)::text from profiles p left join auth.users u on u.id = p.user_id
        where p.user_id is not null and u.id is null;
```

The last four should all be `0`. The "wrong `account_id`" one is the most
valuable: it proves the denormalised column agrees with its parent, not merely
that it is populated.

**Then log in as an existing user.** That is the only real proof the `auth`
migration worked.

---

## Cutting over

1. Swap `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY`. Restart — env is read at startup.
2. Leave `ENCRYPTION_KEY` **exactly as it is**. Channel tokens and AI keys are
   AES-256-GCM encrypted with it before storage; a different key orphans every
   connected channel.
3. Reconfigure Auth on the new project: Site URL, Redirect URLs.
4. Google sign-in: paste the client ID and secret into the new project, **and**
   add `https://<new-ref>.supabase.co/auth/v1/callback` to Authorised redirect
   URIs in Google Cloud Console. Missing that last step is the most common
   cause of "everything is configured but login fails".
   This app also uses Google Identity Services, so the client ID must go in
   **Authorized Client IDs** on the Supabase provider too, or the token
   audience will not validate. See `src/lib/auth/google-gis.ts`.
5. Reconnect WhatsApp / Instagram / Messenger. Channel tokens are tied to the
   old project's rows even when the encryption key is unchanged.
6. Keep the old project until the new one is proven. Delete it only afterwards.

## Handling secrets

Put connection strings in `.env.local` and read them with
`node --env-file=.env.local`. Never echo one — **including in error handlers**.
We printed a full connection string in a failure message during this migration
and had to rotate the password. Redact before logging:

```js
url.replace(/\/\/([^:]+):[^@]*@/, '//$1:***@')
```

---

## What changes when self-hosting

- `auth` is still a normal Postgres schema; the same copy works.
- Storage is whatever you point it at — migrate files separately, as above.
- You will have superuser, so `session_replication_role` will genuinely work.
- Use `pg_dump`/`pg_restore`. At that point you control the machine, so the
  reason for `migrate-db.mjs` has gone away.
