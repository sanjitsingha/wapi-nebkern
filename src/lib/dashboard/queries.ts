import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addLocalDays,
  dayKeysBetween,
  daysAgoStart,
  daysInRangeInclusive,
  DOW_SHORT_MON_FIRST,
  localDayKey,
  mondayIndex,
  startOfLocalDay,
} from './date-utils';
import {
  META_ERROR_CODE_MAP,
  errorSummary,
  extractErrorCode,
} from '@/lib/whatsapp/errors';
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  DashboardDateRange,
  DashboardMemberFilter,
  FailureGroup,
  FailureReport,
  MetricsBundle,
  PipelineDonutData,
  PipelineStageSlice,
  ResponseTimeBucket,
  ResponseTimeSummary,
} from './types';

// ------------------------------------------------------------
// All client-side aggregation. RLS scopes every query to the
// signed-in user automatically, so we never pass user_id explicitly
// for tenancy. When a team member filter is selected, we scope the
// queries to that specific teammate's assigned items.
// ------------------------------------------------------------

type DB = SupabaseClient;

// --- 1. Metric cards ---------------------------------------------------

export async function loadMetrics(
  db: DB,
  range: DashboardDateRange,
  member?: DashboardMemberFilter | null
): Promise<MetricsBundle> {
  // The selected window is [from, to] inclusive. We extend `to` to the
  // start of the following day so the upper bound is exclusive and
  // captures everything that happened on the `to` day. The previous
  // window is the equal-length span immediately before `from`, so each
  // card can show a like-for-like "vs previous period" delta.
  const dayCount = daysInRangeInclusive(range.from, range.to);
  const rangeStart = startOfLocalDay(range.from).toISOString();
  const rangeEnd = addLocalDays(range.to, 1).toISOString();
  const prevStart = addLocalDays(range.from, -dayCount).toISOString();

  let curConvQ = db
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', rangeStart)
    .lt('created_at', rangeEnd);

  let prevConvQ = db
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', prevStart)
    .lt('created_at', rangeStart);

  let curContactsQ = db
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', rangeStart)
    .lt('created_at', rangeEnd);

  let prevContactsQ = db
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', prevStart)
    .lt('created_at', rangeStart);

  const curMsgQ = member?.userId
    ? db
        .from('messages')
        .select('id, conversations!inner(assigned_agent_id)', {
          count: 'exact',
          head: true,
        })
        .eq('sender_type', 'agent')
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd)
    : db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'agent')
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

  const prevMsgQ = member?.userId
    ? db
        .from('messages')
        .select('id, conversations!inner(assigned_agent_id)', {
          count: 'exact',
          head: true,
        })
        .eq('sender_type', 'agent')
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', prevStart)
        .lt('created_at', rangeStart)
    : db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'agent')
        .gte('created_at', prevStart)
        .lt('created_at', rangeStart);

  // Failed sends, current and previous window. Same shape as the sent
  // counts above so the card can show a delta — a failure count without
  // "and it was 3 last week" does not say whether anything changed.
  const failedFor = (start: string, end: string) =>
    member?.userId
      ? db
          .from('messages')
          .select('id, conversations!inner(assigned_agent_id)', {
            count: 'exact',
            head: true,
          })
          .eq('status', 'failed')
          .eq('conversations.assigned_agent_id', member.userId)
          .gte('created_at', start)
          .lt('created_at', end)
      : db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', start)
          .lt('created_at', end);

  const curFailedQ = failedFor(rangeStart, rangeEnd);
  const prevFailedQ = failedFor(prevStart, rangeStart);

  let dealsQ = db.from('deals').select('value, status').eq('status', 'open');

  if (member?.userId) {
    curConvQ = curConvQ.eq('assigned_agent_id', member.userId);
    prevConvQ = prevConvQ.eq('assigned_agent_id', member.userId);
    curContactsQ = curContactsQ.eq('user_id', member.userId);
    prevContactsQ = prevContactsQ.eq('user_id', member.userId);
  }

  if (member?.profileId) {
    dealsQ = dealsQ.eq('assigned_to', member.profileId);
  }

  const [
    newConvCur,
    newConvPrev,
    newContactsCur,
    newContactsPrev,
    messagesCur,
    messagesPrev,
    failedCur,
    failedPrev,
    openDeals,
  ] = await Promise.all([
    curConvQ,
    prevConvQ,
    curContactsQ,
    prevContactsQ,
    curMsgQ,
    prevMsgQ,
    curFailedQ,
    prevFailedQ,
    dealsQ,
  ]);

  const openDealsRows = (openDeals.data ?? []) as { value: number | null }[];
  const openDealsValue = openDealsRows.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  );

  return {
    newConversations: {
      current: newConvCur.count ?? 0,
      previous: newConvPrev.count ?? 0,
    },
    newContacts: {
      current: newContactsCur.count ?? 0,
      previous: newContactsPrev.count ?? 0,
    },
    messagesSent: {
      current: messagesCur.count ?? 0,
      previous: messagesPrev.count ?? 0,
    },
    messagesFailed: {
      current: failedCur.count ?? 0,
      previous: failedPrev.count ?? 0,
    },
    openDealsValue,
    openDealsCount: openDealsRows.length,
  };
}

// --- 2. Conversations over time ---------------------------------------

export async function loadConversationsSeries(
  db: DB,
  range: DashboardDateRange,
  member?: DashboardMemberFilter | null
): Promise<ConversationsSeriesPoint[]> {
  const start = startOfLocalDay(range.from).toISOString();
  const end = addLocalDays(range.to, 1).toISOString();

  const query = member?.userId
    ? db
        .from('messages')
        .select(
          'created_at, sender_type, conversations!inner(assigned_agent_id)'
        )
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
    : db
        .from('messages')
        .select('created_at, sender_type')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const keys = dayKeysBetween(range.from, range.to);
  const buckets = new Map<string, { incoming: number; outgoing: number }>();
  for (const k of keys) buckets.set(k, { incoming: 0, outgoing: 0 });

  for (const row of (data ?? []) as {
    created_at: string;
    sender_type: string;
  }[]) {
    const key = localDayKey(row.created_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.sender_type === 'customer') bucket.incoming += 1;
    else bucket.outgoing += 1; // agent + bot both count as outgoing
  }

  return keys.map((day) => ({
    day,
    ...(buckets.get(day) ?? { incoming: 0, outgoing: 0 }),
  }));
}

// --- 3. Pipeline donut -------------------------------------------------

export async function loadPipelineDonut(
  db: DB,
  member?: DashboardMemberFilter | null
): Promise<PipelineDonutData> {
  let dealsQ = db
    .from('deals')
    .select('stage_id, value, status')
    .eq('status', 'open');

  if (member?.profileId) {
    dealsQ = dealsQ.eq('assigned_to', member.profileId);
  }

  const [stagesRes, dealsRes] = await Promise.all([
    db
      .from('pipeline_stages')
      .select('id, name, color, pipeline_id, position')
      .order('position'),
    dealsQ,
  ]);

  const stages = (stagesRes.data ?? []) as {
    id: string;
    name: string;
    color: string;
  }[];
  const deals = (dealsRes.data ?? []) as {
    stage_id: string;
    value: number | null;
  }[];

  const byStage = new Map<string, { count: number; total: number }>();
  for (const d of deals) {
    const row = byStage.get(d.stage_id) ?? { count: 0, total: 0 };
    row.count += 1;
    row.total += d.value ?? 0;
    byStage.set(d.stage_id, row);
  }

  const slices: PipelineStageSlice[] = stages
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color || '#64748b',
      dealCount: byStage.get(s.id)?.count ?? 0,
      totalValue: byStage.get(s.id)?.total ?? 0,
    }))
    // Hide empty stages from the ring (but we'd still show them in the
    // legend if the user wanted a full breakdown — trimming keeps the
    // visual clean for the common case).
    .filter((s) => s.totalValue > 0 || s.dealCount > 0);

  return {
    stages: slices,
    totalValue: slices.reduce((sum, s) => sum + s.totalValue, 0),
  };
}

// --- 4. Response time by day of week ----------------------------------

export async function loadResponseTime(
  db: DB,
  member?: DashboardMemberFilter | null
): Promise<ResponseTimeSummary> {
  // Pull the last 14 days of messages in one shot, then walk per
  // conversation to find each "first inbound" → "first subsequent
  // outbound" pair. This widget is a rolling "this week vs last week"
  // health check anchored to the current calendar week, so it stays
  // independent of the dashboard's selected date range (which drives the
  // metric cards + conversations chart instead).
  const fourteenDaysAgo = daysAgoStart(13).toISOString();

  const query = member?.userId
    ? db
        .from('messages')
        .select(
          'conversation_id, sender_type, created_at, conversations!inner(assigned_agent_id)'
        )
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', fourteenDaysAgo)
        .order('conversation_id', { ascending: true })
        .order('created_at', { ascending: true })
    : db
        .from('messages')
        .select('conversation_id, sender_type, created_at')
        .gte('created_at', fourteenDaysAgo)
        .order('conversation_id', { ascending: true })
        .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as {
    conversation_id: string;
    sender_type: string;
    created_at: string;
  }[];

  // Group per conversation, pair unreplied customer messages with the
  // next outbound message from the agent/bot. A single customer message
  // can only count once (avoids inflating averages if the customer
  // double-messages while the agent takes time to reply).
  interface Sample {
    customerAt: Date;
    responseAt: Date;
  }
  const samples: Sample[] = [];

  let currentConv = '';
  let pendingCustomer: Date | null = null;
  for (const row of rows) {
    if (row.conversation_id !== currentConv) {
      currentConv = row.conversation_id;
      pendingCustomer = null;
    }
    const ts = new Date(row.created_at);
    if (row.sender_type === 'customer') {
      if (!pendingCustomer) pendingCustomer = ts;
    } else if (pendingCustomer) {
      samples.push({ customerAt: pendingCustomer, responseAt: ts });
      pendingCustomer = null;
    }
  }

  const now = new Date();
  const thisWeekStart = daysAgoStart(mondayIndex(now));
  const lastWeekStart = daysAgoStart(mondayIndex(now) + 7);

  // Per-day-of-week buckets, averaged over both weeks' worth of data
  // so each bar has more samples to stand on. If a day has no samples
  // its avgMinutes stays null and the chart renders the bar muted.
  const byDow = new Map<number, number[]>();
  for (let i = 0; i < 7; i++) byDow.set(i, []);
  const thisWeekMins: number[] = [];
  const lastWeekMins: number[] = [];

  for (const s of samples) {
    const diffMin = (s.responseAt.getTime() - s.customerAt.getTime()) / 60_000;
    if (diffMin < 0) continue;
    const dow = mondayIndex(s.customerAt);
    byDow.get(dow)!.push(diffMin);
    if (s.customerAt >= thisWeekStart) {
      thisWeekMins.push(diffMin);
    } else if (s.customerAt >= lastWeekStart && s.customerAt < thisWeekStart) {
      lastWeekMins.push(diffMin);
    }
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const buckets: ResponseTimeBucket[] = Array.from({ length: 7 }, (_, dow) => {
    const samples = byDow.get(dow) ?? [];
    return {
      dow,
      avgMinutes: avg(samples),
      samples: samples.length,
    };
  });

  // Silence unused-label warnings — keep the arrays explicitly named
  // for readability above.
  void DOW_SHORT_MON_FIRST;

  return {
    buckets,
    thisWeekAvg: avg(thisWeekMins),
    lastWeekAvg: avg(lastWeekMins),
  };
}

// --- 5. Activity feed --------------------------------------------------

export async function loadActivity(
  db: DB,
  limit = 20,
  member?: DashboardMemberFilter | null
): Promise<ActivityItem[]> {
  // Pull ~10 from each source (plenty of headroom after merge-sort),
  // then interleave by timestamp. The individual per-table limits
  // keep the payload small; the final limit is enforced after sort.
  const msgsQ = member?.userId
    ? db
        .from('messages')
        .select(
          'id, content_text, sender_type, created_at, conversation_id, conversations!inner(contact_id, assigned_agent_id, contacts(name, phone))'
        )
        .eq('sender_type', 'customer')
        .eq('conversations.assigned_agent_id', member.userId)
        .order('created_at', { ascending: false })
        .limit(10)
    : db
        .from('messages')
        .select(
          'id, content_text, sender_type, created_at, conversation_id, conversations(contact_id, contacts(name, phone))'
        )
        .eq('sender_type', 'customer')
        .order('created_at', { ascending: false })
        .limit(10);

  const contactsQ = member?.userId
    ? db
        .from('contacts')
        .select('id, name, phone, created_at')
        .eq('user_id', member.userId)
        .order('created_at', { ascending: false })
        .limit(10)
    : db
        .from('contacts')
        .select('id, name, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

  const dealsQ = member?.profileId
    ? db
        .from('deals')
        .select('id, title, updated_at, stage:pipeline_stages(name)')
        .eq('assigned_to', member.profileId)
        .order('updated_at', { ascending: false })
        .limit(10)
    : db
        .from('deals')
        .select('id, title, updated_at, stage:pipeline_stages(name)')
        .order('updated_at', { ascending: false })
        .limit(10);

  const broadcastsQ = member?.userId
    ? db
        .from('broadcasts')
        .select('id, name, status, total_recipients, created_at')
        .eq('user_id', member.userId)
        .order('created_at', { ascending: false })
        .limit(5)
    : db
        .from('broadcasts')
        .select('id, name, status, total_recipients, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

  const autoLogsQ = db
    .from('automation_logs')
    .select(
      'id, trigger_event, status, created_at, automation:automations(name), contact:contacts(name, phone)'
    )
    .order('created_at', { ascending: false })
    .limit(member?.userId ? 5 : 10);

  const [msgs, contacts, deals, broadcasts, autoLogs] = await Promise.all([
    msgsQ,
    contactsQ,
    dealsQ,
    broadcastsQ,
    autoLogsQ,
  ]);

  const items: ActivityItem[] = [];

  // PostgREST returns nested selections as arrays by default, even when
  // the foreign key is 1:1. We normalise by taking [0] on each level.
  for (const m of (msgs.data ?? []) as unknown as Array<{
    id: string;
    content_text: string | null;
    created_at: string;
    conversation_id: string;
    conversations:
      | {
          contact_id: string | null;
          contacts:
            | { name: string | null; phone: string }[]
            | { name: string | null; phone: string }
            | null;
        }[]
      | {
          contact_id: string | null;
          contacts:
            | { name: string | null; phone: string }[]
            | { name: string | null; phone: string }
            | null;
        }
      | null;
  }>) {
    const conv = Array.isArray(m.conversations)
      ? m.conversations[0]
      : m.conversations;
    const contact = Array.isArray(conv?.contacts)
      ? conv?.contacts[0]
      : conv?.contacts;
    const who = contact?.name || contact?.phone || 'Unknown';
    items.push({
      id: `msg-${m.id}`,
      kind: 'message',
      text: `New message from ${who}`,
      at: m.created_at,
      href: `/inbox?c=${m.conversation_id}`,
    });
  }

  for (const c of (contacts.data ?? []) as Array<{
    id: string;
    name: string | null;
    phone: string;
    created_at: string;
  }>) {
    items.push({
      id: `contact-${c.id}`,
      kind: 'contact',
      text: `New contact: ${c.name || c.phone}`,
      at: c.created_at,
      href: '/contacts',
    });
  }

  for (const d of (deals.data ?? []) as unknown as Array<{
    id: string;
    title: string;
    updated_at: string;
    stage: { name: string }[] | { name: string } | null;
  }>) {
    const stage = Array.isArray(d.stage) ? d.stage[0] : d.stage;
    items.push({
      id: `deal-${d.id}`,
      kind: 'deal',
      text: stage?.name
        ? `Deal "${d.title}" in ${stage.name}`
        : `Deal "${d.title}" updated`,
      at: d.updated_at,
      href: '/pipelines',
    });
  }

  for (const b of (broadcasts.data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    total_recipients: number;
    created_at: string;
  }>) {
    const label =
      b.status === 'sent'
        ? `sent to ${b.total_recipients} contacts`
        : `${b.status} (${b.total_recipients} recipients)`;
    items.push({
      id: `broadcast-${b.id}`,
      kind: 'broadcast',
      text: `Broadcast "${b.name}" ${label}`,
      at: b.created_at,
      href: '/campaigns',
    });
  }

  for (const l of (autoLogs.data ?? []) as unknown as Array<{
    id: string;
    trigger_event: string;
    status: string;
    created_at: string;
    automation: { name: string }[] | { name: string } | null;
    contact:
      | { name: string | null; phone: string }[]
      | { name: string | null; phone: string }
      | null;
  }>) {
    const automation = Array.isArray(l.automation)
      ? l.automation[0]
      : l.automation;
    const contact = Array.isArray(l.contact) ? l.contact[0] : l.contact;
    const who = contact?.name || contact?.phone || 'a contact';
    const autoName = automation?.name || 'Automation';
    items.push({
      id: `auto-${l.id}`,
      kind: 'automation',
      text: `Automation "${autoName}" ${l.status === 'failed' ? 'failed for' : 'triggered for'} ${who}`,
      at: l.created_at,
    });
  }

  return items
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0))
    .slice(0, limit);
}

// --- 6. Delivery failures ---------------------------------------------

/**
 * How many failures to read before grouping.
 *
 * Grouping has to happen in JS: the cause lives inside `error_message`
 * as text, so Postgres cannot GROUP BY it without a generated column.
 * That is a fair trade at this cap — a range with more than 500
 * failures has a problem the top three groups will name regardless of
 * whether the tail is counted exactly.
 */
const FAILURE_SCAN_LIMIT = 500;

/** How many named broadcasts to list under one cause. */
const BROADCASTS_PER_GROUP = 3;

export async function loadFailures(
  db: DB,
  range: DashboardDateRange,
  member?: DashboardMemberFilter | null
): Promise<FailureReport> {
  // Same windowing as loadMetrics: `to` is inclusive, so the upper
  // bound is the start of the next day.
  const rangeStart = startOfLocalDay(range.from).toISOString();
  const rangeEnd = addLocalDays(range.to, 1).toISOString();

  // The member filter needs the `!inner` join in the SELECT, not just
  // an `.eq` — filtering on an embedded column without it returns
  // every row with the embed nulled instead of narrowing the set. Same
  // shape the message queries above use.
  const failedQ = member?.userId
    ? db
        .from('messages')
        .select(
          'id, error_message, broadcast_id, conversation_id, created_at, conversations!inner(assigned_agent_id)'
        )
        .eq('status', 'failed')
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd)
        .order('created_at', { ascending: false })
        .limit(FAILURE_SCAN_LIMIT)
    : db
        .from('messages')
        .select('id, error_message, broadcast_id, conversation_id, created_at')
        .eq('status', 'failed')
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd)
        .order('created_at', { ascending: false })
        .limit(FAILURE_SCAN_LIMIT);

  // Denominator for the rate. Same window, same filter, so the
  // percentage is honest rather than "failures over all messages ever".
  const sentQ = member?.userId
    ? db
        .from('messages')
        .select('id, conversations!inner(assigned_agent_id)', {
          count: 'exact',
          head: true,
        })
        .eq('sender_type', 'agent')
        .eq('conversations.assigned_agent_id', member.userId)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd)
    : db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_type', 'agent')
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd);

  const [failedRes, sentRes] = await Promise.all([failedQ, sentQ]);

  const rows = (failedRes.data ?? []) as {
    id: string;
    error_message: string | null;
    broadcast_id: string | null;
    conversation_id: string | null;
  }[];

  const total = rows.length;
  const sent = sentRes.count ?? 0;
  // Denominator is attempts, not successes — a 100% failure rate should
  // read as 100%, which `failed / sent` cannot produce.
  const attempts = sent + total;

  if (total === 0) {
    return { total: 0, failureRate: attempts > 0 ? 0 : null, groups: [] };
  }

  // Name the broadcasts involved, so a group can say WHICH campaign
  // rather than just "9 from a broadcast".
  const broadcastIds = [
    ...new Set(rows.map((r) => r.broadcast_id).filter((v): v is string => !!v)),
  ];
  const nameById = new Map<string, string>();
  if (broadcastIds.length > 0) {
    const { data: bcs } = await db
      .from('broadcasts')
      .select('id, name')
      .in('id', broadcastIds);
    for (const b of (bcs ?? []) as { id: string; name: string | null }[]) {
      nameById.set(b.id, b.name || 'Untitled broadcast');
    }
  }

  // Group by code where there is one, and by the message text where
  // there is not — so unmapped errors still collapse together instead
  // of each becoming its own group of one.
  const groups = new Map<
    string,
    FailureGroup & { broadcastTally: Map<string, number> }
  >();

  for (const row of rows) {
    const code = extractErrorCode(row.error_message);
    const title = errorSummary(row.error_message);
    const key = code !== null ? `c${code}` : `t${title}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        code,
        title,
        action: code ? (META_ERROR_CODE_MAP[code]?.action ?? null) : null,
        count: 0,
        broadcastCount: 0,
        broadcasts: [],
        sampleContactId: null,
        broadcastTally: new Map(),
      };
      groups.set(key, g);
    }

    g.count += 1;
    if (row.broadcast_id) {
      g.broadcastCount += 1;
      g.broadcastTally.set(
        row.broadcast_id,
        (g.broadcastTally.get(row.broadcast_id) ?? 0) + 1
      );
    } else if (!g.sampleContactId && row.conversation_id) {
      // First direct-message failure in the group becomes the "go and
      // look at this one" link.
      g.sampleContactId = row.conversation_id;
    }
  }

  const out: FailureGroup[] = [...groups.values()]
    .map(({ broadcastTally, ...g }) => ({
      ...g,
      broadcasts: [...broadcastTally.entries()]
        .map(([id, count]) => ({
          id,
          name: nameById.get(id) ?? 'Untitled broadcast',
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, BROADCASTS_PER_GROUP),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    failureRate: attempts > 0 ? (total / attempts) * 100 : null,
    groups: out,
  };
}
