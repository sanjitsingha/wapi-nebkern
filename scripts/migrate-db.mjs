// Copy data from one Supabase/Postgres database into another.
//
// The target must ALREADY have the schema (run `supabase db push` first).
// This moves rows only — it never creates or alters tables, except for one
// temporary constraint relaxation described below.
//
//   OLD_DB_URL  source connection string
//   NEW_DB_URL  target connection string
//
//   node --env-file=.env.local scripts/migrate-db.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-db.mjs
//
// WHY NOT pg_dump
//
// pg_dump is the right tool and what you should reach for first. This
// exists for machines where it cannot be installed. It is fine for small
// and medium datasets; for millions of rows, use pg_dump on a machine
// that has it.
//
// THE THREE THINGS THAT MAKE THIS NON-TRIVIAL
//
// 1. Foreign keys. Rows must arrive in dependency order, and working that
//    order out across ~50 tables is error-prone. Instead we set
//    `session_replication_role = replica` on the target, which suspends FK
//    and trigger enforcement for the session, then restore it at the end.
//
// 2. Schema drift. The source may be older than the target — here Tokyo
//    stopped at migration 077 while the target is at 081, so `messages`
//    has no `account_id` or `updated_at` there. We copy the INTERSECTION
//    of columns present in both, so newer columns simply take their
//    defaults.
//
// 3. That intersection collides with a NOT NULL. `messages.account_id` is
//    NOT NULL on the target and normally filled by a BEFORE INSERT
//    trigger — but replica mode disables that trigger. So the constraint
//    is dropped for the duration, the column is backfilled from each
//    message's conversation afterwards, and the constraint is restored.
//
// Re-runnable: every insert is ON CONFLICT DO NOTHING, so a partial run
// can simply be repeated.

import pg from 'pg';

const DRY = process.argv.includes('--dry-run');

/**
 * Tables the target seeds itself from migrations. Copying them collides on
 * the primary key and would overwrite the target's own reference data.
 */
const SKIP = new Set([
  'public.billing_plans',
  'storage.buckets',
  'storage.migrations',
  'auth.schema_migrations',
  'supabase_migrations.schema_migrations',
  // Metadata only — the actual bytes live in the storage service, not in
  // Postgres. Copying these rows produces records pointing at objects the
  // target does not have, which shows up as broken images rather than as
  // an error. File storage is always a separate migration from the
  // database; do it deliberately, with the storage API, or not at all.
  'storage.objects',
]);

/**
 * Auth tables worth carrying. `users` and `identities` are what make a
 * login keep working. Sessions, refresh tokens and flow state are
 * deliberately omitted — they expire anyway, and stale ones cause more
 * confusion than they save. Everyone signs in once after the move.
 */
const AUTH_TABLES = ['auth.users', 'auth.identities'];

function redact(url) {
  return url.replace(/\/\/([^:]+):[^@]*@/, '//$1:***@');
}

async function tablesWithRows(client) {
  const { rows } = await client.query(`
    select schemaname as schema, relname as name, n_live_tup as rows
    from pg_stat_user_tables
    where schemaname in ('public','auth','storage') and n_live_tup > 0
    order by schemaname, relname
  `);
  return rows;
}

async function columnsOf(client, schema, table) {
  const { rows } = await client.query(
    `select column_name, data_type, is_generated
       from information_schema.columns
      where table_schema = $1 and table_name = $2`,
    [schema, table],
  );
  // Generated columns cannot be inserted into — the database computes them.
  return rows.filter((r) => r.is_generated !== 'ALWAYS');
}

/**
 * node-postgres reads json/jsonb as real JavaScript values, then has to
 * guess how to send them back. For an object it stringifies (correct), but
 * for an ARRAY it emits a Postgres array literal — `{a,b}` — and the server
 * rejects it with "invalid input syntax for type json". A jsonb column
 * holding `["a","b"]` therefore fails on a straight round trip.
 *
 * Stringify json/jsonb ourselves so the driver never has to guess.
 */
function encodeValue(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === 'json' || dataType === 'jsonb') return JSON.stringify(value);
  return value;
}

async function primaryKeyOf(client, schema, table) {
  const { rows } = await client.query(
    `select a.attname
       from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = ($1 || '.' || quote_ident($2))::regclass and i.indisprimary`,
    [schema, table],
  );
  return rows.map((r) => r.attname);
}

async function copyTable(src, dst, schema, name) {
  const qualified = `${schema}.${name}`;
  if (SKIP.has(qualified)) return { qualified, skipped: 'target seeds this itself' };

  const [srcColInfo, dstColInfo] = await Promise.all([
    columnsOf(src, schema, name),
    columnsOf(dst, schema, name),
  ]);
  if (dstColInfo.length === 0) return { qualified, skipped: 'not present on target' };

  // Intersection, so a source older than the target just omits new columns
  // and lets their defaults apply.
  const dstNames = new Set(dstColInfo.map((c) => c.column_name));
  const srcNames = srcColInfo.map((c) => c.column_name);
  const cols = srcNames.filter((c) => dstNames.has(c));
  const dropped = srcNames.filter((c) => !dstNames.has(c));
  if (cols.length === 0) return { qualified, skipped: 'no columns in common' };

  // Types come from the TARGET — that is what the insert must satisfy.
  const typeOf = new Map(dstColInfo.map((c) => [c.column_name, c.data_type]));

  const { rows } = await src.query(
    `select ${cols.map((c) => `"${c}"`).join(',')} from ${schema}."${name}"`,
  );
  if (rows.length === 0) return { qualified, copied: 0, dropped };
  if (DRY) return { qualified, copied: rows.length, dryRun: true, dropped };

  const pk = await primaryKeyOf(dst, schema, name);
  const conflict = pk.length
    ? `on conflict (${pk.map((c) => `"${c}"`).join(',')}) do nothing`
    : 'on conflict do nothing';

  const colList = cols.map((c) => `"${c}"`).join(',');
  let copied = 0;
  // Batched, so a wide table does not build one enormous statement.
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    slice.forEach((row, r) => {
      values.push(
        '(' + cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',') + ')',
      );
      cols.forEach((c) => params.push(encodeValue(row[c], typeOf.get(c))));
    });
    const res = await dst.query(
      `insert into ${schema}."${name}" (${colList}) values ${values.join(',')} ${conflict}`,
      params,
    );
    copied += res.rowCount ?? 0;
  }
  return { qualified, copied, dropped };
}

async function main() {
  const srcUrl = (process.env.OLD_DB_URL || '').trim();
  const dstUrl = (process.env.NEW_DB_URL || '').trim();
  if (!srcUrl || !dstUrl) {
    console.error('Set OLD_DB_URL and NEW_DB_URL in .env.local');
    process.exit(1);
  }

  const src = new pg.Client({ connectionString: srcUrl, ssl: { rejectUnauthorized: false } });
  const dst = new pg.Client({ connectionString: dstUrl, ssl: { rejectUnauthorized: false } });
  await src.connect();
  await dst.connect();
  console.log('source:', redact(srcUrl));
  console.log('target:', redact(dstUrl));
  console.log(DRY ? '\n*** DRY RUN — nothing will be written ***\n' : '');

  try {
    if (!DRY) {
      // Suspend FK/trigger enforcement so table order stops mattering...
      await dst.query(`set session_replication_role = replica`);
      // ...which also disables the trigger that fills messages.account_id,
      // so the NOT NULL has to come off until the backfill below.
      await dst.query(
        `alter table public.messages alter column account_id drop not null`,
      );
    }

    const present = await tablesWithRows(src);
    const publicTables = present.filter((t) => t.schema !== 'auth');

    console.log('--- auth ---');
    for (const q of AUTH_TABLES) {
      const [schema, name] = q.split('.');
      const r = await copyTable(src, dst, schema, name);
      report(r);
    }

    console.log('\n--- public / storage ---');
    for (const t of publicTables) {
      const r = await copyTable(src, dst, t.schema, t.name);
      report(r);
    }

    if (!DRY) {
      console.log('\n--- post-import ---');
      // messages.account_id: absent on the source, and the trigger that
      // would have filled it was suspended. Derive it from the parent.
      const bf = await dst.query(`
        update public.messages m
           set account_id = c.account_id
          from public.conversations c
         where c.id = m.conversation_id and m.account_id is null
      `);
      console.log(`  backfilled messages.account_id: ${bf.rowCount}`);

      const orphans = await dst.query(
        `select count(*)::int as n from public.messages where account_id is null`,
      );
      if (orphans.rows[0].n === 0) {
        await dst.query(
          `alter table public.messages alter column account_id set not null`,
        );
        console.log('  restored NOT NULL on messages.account_id');
      } else {
        console.log(
          `  WARNING: ${orphans.rows[0].n} messages have no account_id ` +
            `(conversation missing?) — NOT NULL left off, investigate`,
        );
      }

      // Migration 079 mirrors account context into auth.users.app_metadata
      // via triggers, which replica mode suspended. Re-derive it, or every
      // request falls back to the slower query path.
      const sync = await dst.query(`
        select count(*)::int as n from (
          select sync_user_app_metadata(p.user_id)
            from public.profiles p
           where p.user_id is not null
        ) s
      `);
      console.log(`  synced app_metadata for ${sync.rows[0].n} user(s)`);

      await dst.query(`set session_replication_role = default`);
      console.log('  re-enabled constraints');
    }
  } finally {
    await src.end();
    await dst.end();
  }
}

function report(r) {
  if (r.skipped) {
    console.log(`  ${r.qualified.padEnd(34)} skipped — ${r.skipped}`);
  } else {
    const extra = r.dropped?.length
      ? `  (source-only cols ignored: ${r.dropped.join(', ')})`
      : '';
    console.log(
      `  ${r.qualified.padEnd(34)} ${String(r.copied).padStart(5)} rows${r.dryRun ? ' (would copy)' : ''}${extra}`,
    );
  }
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  console.error('Constraints may still be suspended on the target. Run:');
  console.error('  set session_replication_role = default;');
  console.error('  alter table public.messages alter column account_id set not null;');
  process.exit(1);
});
