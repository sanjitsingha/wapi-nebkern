# Rebuilding on a new Supabase project (Tokyo → Mumbai)

Generated files. Safe to delete this whole folder once the move is done —
`supabase/migrations/` remains the source of truth.

## Why this exists

Supabase fixes a project's region at creation and there is no way to change
it. The current project sits in `ap-northeast-1` (Tokyo); this app bills in
INR, checks out through Razorpay, and its policies cite India's DPDP Act, so
Mumbai (`ap-south-1`) is where it belongs — both for latency and for data
residency.

Because there is no production data to preserve, this is a **rebuild, not a
migration**. Nothing is copied. The new project is built from
`supabase/migrations/` and the app is pointed at it.

The five `part-*.sql` files are those 81 migrations concatenated in order and
split into paste-sized chunks for the SQL editor. Splits fall on file
boundaries only, so a failure always leaves you at a known migration.

---

## 1. Create the project

Supabase dashboard → New project.

- **Region: South Asia (Mumbai) — `ap-south-1`.** This is the entire point;
  double-check it before creating, because it cannot be changed afterwards.
- Save the database password somewhere durable. You will not be shown it again.
- The free plan allows two active projects, so the Tokyo one can stay up until
  this is verified.

## 2. Run the bundles

SQL editor → paste each file → Run. **In order**, and only continue when the
previous part succeeds:

```
part-01-of-05.sql   001_initial_schema      → 016_flow_media
part-02-of-05.sql   017_account_sharing     → 024_member_presence
part-03-of-05.sql   025_filter_contacts…    → 044_contact_dob
part-04-of-05.sql   044_instagram_channel   → 064_system_health
part-05-of-05.sql   065_activation_codes    → 079_account_claims…
```

This creates everything: tables, RLS policies, functions, triggers, the
storage buckets (`avatars`, `flow-media`, `chat-media`, `template-media`) and
their policies, and the realtime publication.

It also applies **078** and **079**, which were never run on Tokyo — so the
new project starts with the messages RLS fix and the app_metadata fast path
already in place.

### If a part fails

Read which statement failed. The bundle header lists exactly which migrations
that part contains, so you can find it in `supabase/migrations/`. Most are
written to be idempotent, so re-running a part after a fix is normally safe.

**Known wrinkle — pgvector.** `040_ai_knowledge.sql` runs
`CREATE EXTENSION IF NOT EXISTS vector`. If your project rejects that, run
this once in the SQL editor and re-run part 3:

```sql
create extension if not exists vector with schema extensions;
```

**Two migrations share a number** (`025_*` twice, `044_*` twice). They were
checked: the pairs touch unrelated tables and do not reference each other, so
alphabetical order within each number is fine.

## 3. Verify the schema landed

```sql
select count(*) from information_schema.tables where table_schema = 'public';
select id, public from storage.buckets order by id;
select count(*) from pg_policies where schemaname = 'public';
-- 078 landed?
select column_name from information_schema.columns
 where table_name = 'messages' and column_name in ('account_id','updated_at');
-- 079 landed?
select proname from pg_proc where proname = 'sync_user_app_metadata';
```

Four buckets, both message columns, and the sync function should all be there.

## 4. Point the app at it

New project → Settings → API. Update three values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<new-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new anon key>
SUPABASE_SERVICE_ROLE_KEY=<new service role key>
```

**Leave `ENCRYPTION_KEY` exactly as it is.** It is unrelated to which Supabase
project you use, and changing it would orphan every encrypted channel token.
Nothing to preserve here today, but the habit matters later.

Restart the dev server — env vars are only read at startup.

## 5. Auth settings on the new project

Authentication → URL Configuration:

- **Site URL** — your app's URL
- **Redirect URLs** — add every origin you sign in from, including
  `http://localhost:3000/**` for local work

Authentication → Providers → Google (if you use it):

- Paste the same client ID and secret
- Then in **Google Cloud Console → Credentials → your OAuth client**, add the
  new project's callback to Authorised redirect URIs:
  `https://<new-ref>.supabase.co/auth/v1/callback`

Google sign-in stays broken until that Cloud Console entry exists — it is the
step most easily missed.

## 6. Sign up fresh

There are no users to carry across, so create your account through the normal
signup flow. Then confirm the app works end to end: the onboarding gate, the
inbox, and settings.

If you had an admin email allow-list (`ADMIN_EMAILS`), it still applies — it
lives in the environment, not the database.

## 7. Afterwards

- Reconnect WhatsApp / Instagram / Messenger in Settings — those tokens lived
  in the old project.
- Delete or pause the Tokyo project once you are satisfied, so it stops
  counting against the free-plan project limit.
- Update `{{REGION}}` in the legal pages — it should read Mumbai, India, not
  Tokyo. It appears in the DPA, Security Policy and Subprocessor List.
- Delete this folder.
