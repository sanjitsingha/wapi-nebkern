// ============================================================
// The documentation demo workspace — "Bloom Organics".
//
// Creates (once) a separate login and workspace filled with realistic,
// made-up data, so the screenshots on /docs never show a real
// customer. Run:
//
//   node --env-file=.env.local scripts/docs-demo/seed.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The demo
// login is written to .env.local as DOCS_DEMO_EMAIL / DOCS_DEMO_PASSWORD
// (never printed). Re-running is safe: the user is created once and the
// data only when the workspace is still empty.
//
// Nothing here can message anyone: the workspace has no WhatsApp,
// Instagram or Messenger connected, campaigns are already "sent" or
// drafts, and no automation runs on a schedule.
// ============================================================

import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = (k) => process.env[k]?.trim();
const url = env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const EMAIL = env('DOCS_DEMO_EMAIL') || 'docs-demo@instant.nebkern.com';
const OWNER_NAME = 'Riya Sharma';
const BRAND = 'Bloom Organics';

function check(error, what) {
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
}

const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();
const daysFromNow = (d) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

// ── 1. The login ────────────────────────────────────────────
async function ensureUser() {
  const { data: list, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  check(error, 'list users');
  const existing = list.users.find((u) => u.email === EMAIL);
  if (existing) return existing.id;

  const password = randomBytes(18).toString('base64url');
  const { data, error: createError } = await db.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: OWNER_NAME },
  });
  check(createError, 'create user');

  // Only the local file learns the password.
  const envFile = readFileSync('.env.local', 'utf8');
  const lines = [];
  if (!/^DOCS_DEMO_EMAIL=/m.test(envFile)) lines.push(`DOCS_DEMO_EMAIL=${EMAIL}`);
  lines.push(`DOCS_DEMO_PASSWORD=${password}`);
  appendFileSync('.env.local', `\n# Documentation demo workspace (scripts/docs-demo)\n${lines.join('\n')}\n`);
  console.log('Created the demo login; its password is in .env.local.');
  return data.user.id;
}

// ── 2. The workspace, past every first-run step ─────────────
async function workspaceFor(userId) {
  for (let i = 0; i < 10; i++) {
    const { data } = await db.from('profiles').select('account_id').eq('user_id', userId).maybeSingle();
    if (data?.account_id) return data.account_id;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error('The signup trigger did not create a workspace.');
  process.exit(1);
}

// ── 3. The data ─────────────────────────────────────────────
const TAGS = [
  { name: 'VIP', color: '#8b5cf6', description: 'Repeat buyers with 3+ orders.' },
  { name: 'New lead', color: '#3b82f6', description: 'First message in the last 7 days.' },
  { name: 'Wholesale', color: '#10b981', description: 'Salons and stores buying in bulk.' },
  { name: 'Follow up', color: '#f59e0b', description: 'Waiting on our reply or a callback.' },
  { name: 'Refund', color: '#ef4444', description: 'Open return or refund request.' },
  { name: 'Influencer', color: '#ec4899', description: 'Creators we collaborate with.' },
];

// Fictional people; numbers in a range we never message.
const CONTACTS = [
  { name: 'Ananya Iyer', phone: '917000000101', email: 'ananya.iyer@example.com', city: 'Bengaluru', company: null, tags: ['VIP'] },
  { name: 'Rohan Mehta', phone: '917000000102', email: 'rohan@glowsalon.example', city: 'Mumbai', company: 'Glow Salon', tags: ['Wholesale', 'Follow up'] },
  { name: 'Priya Nair', phone: '917000000103', email: 'priya.nair@example.com', city: 'Kochi', company: null, tags: ['New lead'] },
  { name: 'Karan Malhotra', phone: '917000000104', email: null, city: 'Delhi', company: null, tags: ['Refund'] },
  { name: 'Sneha Kulkarni', phone: '917000000105', email: 'sneha.k@example.com', city: 'Pune', company: null, tags: ['VIP', 'Influencer'] },
  { name: 'Arjun Reddy', phone: '917000000106', email: 'arjun@greenleaf.example', city: 'Hyderabad', company: 'Greenleaf Stores', tags: ['Wholesale'] },
  { name: 'Meera Joshi', phone: '917000000107', email: null, city: 'Jaipur', company: null, tags: ['New lead'] },
  { name: 'Vikram Singh', phone: '917000000108', email: 'vikram.singh@example.com', city: 'Chandigarh', company: null, tags: [] },
  { name: 'Ishita Banerjee', phone: '917000000109', email: 'ishita.b@example.com', city: 'Kolkata', company: null, tags: ['Follow up'] },
  { name: 'Aditya Rao', phone: '917000000110', email: null, city: 'Mysuru', company: null, tags: [] },
  { name: 'Neha Gupta', phone: '917000000111', email: 'neha.gupta@example.com', city: 'Lucknow', company: null, tags: ['VIP'] },
  { name: 'Farhan Sheikh', phone: '917000000112', email: 'farhan@urbanspa.example', city: 'Mumbai', company: 'Urban Spa', tags: ['Wholesale', 'New lead'] },
];

// A few chats, newest last-message first. `ago` is minutes before now.
const CHATS = [
  {
    who: 'Ananya Iyer', unread: 2, status: 'open',
    msgs: [
      ['customer', 'Hi! Is the Vitamin C serum back in stock? 🍊', 95],
      ['agent', 'Hi Ananya! Yes, it came back this morning. Shall I reserve a bottle for you?', 92],
      ['customer', 'Yes please, 2 bottles. Can you send it to my Indiranagar address?', 12],
      ['customer', 'Also, is there any offer for VIP members this week?', 11],
    ],
  },
  {
    who: 'Rohan Mehta', unread: 0, status: 'open',
    msgs: [
      ['customer', 'We want to stock your face wash range at Glow Salon. What are the wholesale rates?', 300],
      ['agent', 'Great to hear, Rohan! For 50+ units it is ₹180 per unit. I can share our full wholesale catalogue.', 290],
      ['customer', 'Please do. We would start with 100 units.', 60],
      ['agent', 'Sent! I have also added a 5% first-order discount. Let me know when you are ready to place it.', 45],
    ],
  },
  {
    who: 'Karan Malhotra', unread: 1, status: 'open',
    msgs: [
      ['customer', 'My order #BL2041 arrived with a broken lid on the moisturiser 😕', 180],
      ['agent', 'So sorry about that, Karan. Could you send a photo? We will replace it right away.', 170],
      ['customer', 'Sent the photo just now. When will the replacement ship?', 25],
    ],
  },
  {
    who: 'Priya Nair', unread: 0, status: 'pending',
    msgs: [
      ['customer', 'Which product is best for oily skin?', 600],
      ['bot', 'Our Neem & Tea Tree face wash and the oil-free gel moisturiser are customer favourites for oily skin.', 599],
      ['customer', 'Thanks! Do you deliver to Kochi?', 400],
      ['agent', 'Yes, we deliver across India in 3–5 days. Free shipping above ₹499.', 390],
    ],
  },
  {
    who: 'Sneha Kulkarni', unread: 0, status: 'open',
    msgs: [
      ['customer', 'Loved the new rose face mist! Can I feature it in my next reel? 🌹', 1500],
      ['agent', 'We would love that, Sneha! I will send you the launch kit and a code for your followers.', 1490],
    ],
  },
  {
    who: 'Arjun Reddy', unread: 0, status: 'closed',
    msgs: [
      ['customer', 'Invoice for the last batch received. Payment done.', 2900],
      ['agent', 'Thank you, Arjun! Payment confirmed. Your next batch ships Monday.', 2880],
    ],
  },
];

/** Rows of `table` in the workspace — each part seeds only when empty,
 *  so a run that stopped part-way picks up where it left off. */
async function has(table, accountId) {
  const { count } = await db.from(table).select('id', { count: 'exact', head: true }).eq('account_id', accountId);
  return (count ?? 0) > 0;
}

async function seed(accountId, userId, profileId) {
  if (!(await has('contacts', accountId))) await seedCore(accountId, userId);

  const { data: tagRows } = await db.from('tags').select('id, name').eq('account_id', accountId);
  const tagId = Object.fromEntries((tagRows ?? []).map((t) => [t.name, t.id]));
  const { data: contactRows } = await db.from('contacts').select('id, name').eq('account_id', accountId);
  const contactId = Object.fromEntries((contactRows ?? []).map((c) => [c.name, c.id]));

  if (!(await has('deals', accountId))) await seedDeals(accountId, userId, profileId, contactId);
  if (!(await has('message_templates', accountId))) await seedTemplates(accountId, userId);
  if (!(await has('quick_replies', accountId))) await seedQuickReplies(accountId, userId);
  if (!(await has('broadcasts', accountId))) await seedCampaigns(accountId, userId);
  if (!(await has('automations', accountId))) await seedAutomations(accountId, userId, tagId);
  console.log('The demo workspace is ready.');
}

async function seedCore(accountId, userId) {

  // Tags
  const { data: tags, error: tagError } = await db
    .from('tags')
    .insert(TAGS.map((t) => ({ ...t, user_id: userId, account_id: accountId })))
    .select('id, name');
  check(tagError, 'tags');
  const tagId = Object.fromEntries(tags.map((t) => [t.name, t.id]));

  // Custom fields
  const { data: fields, error: fieldError } = await db
    .from('custom_fields')
    .insert([
      { field_name: 'Lead source', field_type: 'dropdown', field_options: { options: ['Instagram', 'Website', 'Referral', 'Walk-in'] }, is_required: false },
      { field_name: 'Skin type', field_type: 'dropdown', field_options: { options: ['Oily', 'Dry', 'Combination', 'Sensitive'] }, is_required: false },
      { field_name: 'Lifetime orders', field_type: 'number', is_required: false },
      { field_name: 'Birthday', field_type: 'date', is_required: false },
    ].map((f) => ({ ...f, user_id: userId, account_id: accountId })))
    .select('id, field_name');
  check(fieldError, 'custom fields');
  const fieldId = Object.fromEntries(fields.map((f) => [f.field_name, f.id]));

  // Contacts (created_via left empty: added by hand, as an import would)
  const { data: contacts, error: contactError } = await db
    .from('contacts')
    .insert(CONTACTS.map((c) => ({
      name: c.name, phone: c.phone, email: c.email, city: c.city, company: c.company,
      country: 'India', user_id: userId, account_id: accountId,
    })))
    .select('id, name');
  check(contactError, 'contacts');
  const contactId = Object.fromEntries(contacts.map((c) => [c.name, c.id]));

  const contactTags = CONTACTS.flatMap((c) => c.tags.map((t) => ({ contact_id: contactId[c.name], tag_id: tagId[t] })));
  check((await db.from('contact_tags').insert(contactTags)).error, 'contact tags');

  const values = [
    ['Ananya Iyer', 'Lead source', 'Instagram'], ['Ananya Iyer', 'Skin type', 'Combination'], ['Ananya Iyer', 'Lifetime orders', '7'],
    ['Rohan Mehta', 'Lead source', 'Referral'], ['Priya Nair', 'Lead source', 'Website'], ['Priya Nair', 'Skin type', 'Oily'],
    ['Sneha Kulkarni', 'Lead source', 'Instagram'], ['Sneha Kulkarni', 'Lifetime orders', '5'], ['Sneha Kulkarni', 'Birthday', '1996-04-18'],
  ].map(([who, field, value]) => ({ contact_id: contactId[who], custom_field_id: fieldId[field], value }));
  check((await db.from('contact_custom_values').insert(values)).error, 'custom values');

  // Conversations and messages
  for (const chat of CHATS) {
    const last = chat.msgs[chat.msgs.length - 1];
    const lastCustomer = [...chat.msgs].reverse().find((m) => m[0] === 'customer');
    const { data: conv, error } = await db
      .from('conversations')
      .insert({
        user_id: userId, account_id: accountId, contact_id: contactId[chat.who], channel: 'whatsapp',
        status: chat.status, unread_count: chat.unread, assigned_agent_id: userId,
        last_message_text: last[1], last_message_at: minutesAgo(last[2]),
        customer_replied_at: lastCustomer ? minutesAgo(lastCustomer[2]) : null,
        ai_autoreply_disabled: true,
      })
      .select('id')
      .single();
    check(error, 'conversation');
    const rows = chat.msgs.map(([sender, text, ago]) => ({
      conversation_id: conv.id, account_id: accountId, sender_type: sender,
      sender_id: sender === 'agent' ? userId : null, content_type: 'text', content_text: text,
      status: sender === 'customer' ? 'delivered' : 'read', created_at: minutesAgo(ago),
    }));
    check((await db.from('messages').insert(rows)).error, 'messages');
  }

  // Notes
  check((await db.from('contact_notes').insert([
    { contact_id: contactId['Ananya Iyer'], note_text: 'Prefers evening deliveries. Allergic to fragrance — suggest the unscented range.', created_at: minutesAgo(3000) },
    { contact_id: contactId['Ananya Iyer'], note_text: 'Asked about the Diwali gift box; send details when it launches.', created_at: minutesAgo(900) },
    { contact_id: contactId['Rohan Mehta'], note_text: 'Decision maker for Glow Salon’s 3 branches. Wants net-30 payment terms.', created_at: minutesAgo(280) },
    { contact_id: contactId['Karan Malhotra'], note_text: 'Replacement approved. Ship with the next dispatch, no charge.', created_at: minutesAgo(20) },
  ].map((n) => ({ ...n, user_id: userId, account_id: accountId })))).error, 'notes');

}

async function seedDeals(accountId, userId, profileId, contactId) {
  // Pipeline and deals (reuse the workspace's pipeline if signup made one)
  let { data: pipeline } = await db.from('pipelines').select('id').eq('account_id', accountId).limit(1).maybeSingle();
  if (!pipeline) {
    const res = await db.from('pipelines').insert({ name: 'Sales', user_id: userId, account_id: accountId }).select('id').single();
    check(res.error, 'pipeline');
    pipeline = res.data;
  }
  let { data: stages } = await db.from('pipeline_stages').select('id, name, position').eq('pipeline_id', pipeline.id).order('position');
  if (!stages?.length) {
    const res = await db.from('pipeline_stages').insert(
      [['New lead', '#3b82f6'], ['Contacted', '#8b5cf6'], ['Negotiation', '#f59e0b'], ['Won', '#10b981']]
        .map(([name, color], position) => ({ pipeline_id: pipeline.id, name, color, position })),
    ).select('id, name, position');
    check(res.error, 'stages');
    stages = res.data;
  }
  const stage = (i) => stages[Math.min(i, stages.length - 1)].id;
  check((await db.from('deals').insert([
    { title: 'Glow Salon — 100 units face wash', value: 18000, contact: 'Rohan Mehta', stage: 2, close: 7 },
    { title: 'Greenleaf Stores — quarterly restock', value: 42000, contact: 'Arjun Reddy', stage: 1, close: 21 },
    { title: 'Urban Spa — starter order', value: 9500, contact: 'Farhan Sheikh', stage: 0, close: 14 },
    { title: 'Ananya — Diwali gift boxes', value: 4800, contact: 'Ananya Iyer', stage: 1, close: 10 },
    { title: 'Sneha — creator kit', value: 2500, contact: 'Sneha Kulkarni', stage: 3, close: -2 },
  ].map((d) => ({
    title: d.title, value: d.value, currency: 'INR', contact_id: contactId[d.contact], pipeline_id: pipeline.id,
    stage_id: stage(d.stage), status: 'open', expected_close_date: daysFromNow(d.close),
    user_id: userId, account_id: accountId, assigned_to: profileId,
  })))).error, 'deals');
}

async function seedTemplates(accountId, userId) {
  // Templates (as if approved by Meta; nothing is ever sent from here)
  check((await db.from('message_templates').insert([
    { name: 'order_shipped', category: 'Utility', language: 'en', body_text: 'Hi {{1}}, your Bloom Organics order {{2}} is on its way! Track it here: {{3}}', footer_text: 'Bloom Organics', sample_values: { body: ['Ananya', '#BL2041', 'bloom.example/track'] } },
    { name: 'festive_offer', category: 'Marketing', language: 'en', header_type: 'text', header_content: 'Diwali Glow Sale ✨', body_text: 'Hi {{1}}, get 20% off our bestselling serums this Diwali. Use code GLOW20 at checkout.', footer_text: 'Reply STOP to opt out', sample_values: { body: ['Ananya'] } },
    { name: 'feedback_request', category: 'Marketing', language: 'en', body_text: 'Hi {{1}}, how are you liking your new skincare routine? Reply with a rating from 1 to 5 🌿', sample_values: { body: ['Priya'] } },
    { name: 'payment_reminder', category: 'Utility', language: 'en', body_text: 'Hi {{1}}, a gentle reminder that invoice {{2}} of ₹{{3}} is due on {{4}}.', sample_values: { body: ['Rohan', 'INV-118', '18,000', '30 Oct'] } },
  ].map((t) => ({ ...t, status: 'APPROVED', template_type: 'standard', user_id: userId, account_id: accountId })))).error, 'templates');
}

async function seedQuickReplies(accountId, userId) {
  // Quick replies
  check((await db.from('quick_replies').insert([
    { shortcut: 'thanks', body: 'Thank you for shopping with *Bloom Organics*! 🌿 Let us know if there is anything else we can help with.' },
    { shortcut: 'shipping', body: 'We deliver across India in 3–5 working days. Shipping is *free* on orders above ₹499.' },
    { shortcut: 'returns', body: 'You can return unopened products within 15 days. Share your order number and we will arrange a pickup.' },
    { shortcut: 'wholesale', body: 'For salons and stores we offer wholesale pricing from 50 units. Shall I send our catalogue?' },
  ].map((q) => ({ ...q, user_id: userId, account_id: accountId })))).error, 'quick replies');
}

async function seedCampaigns(accountId, userId) {
  // Campaigns: already sent, or drafts — never scheduled
  check((await db.from('broadcasts').insert([
    { name: 'Diwali Glow Sale', template_name: 'festive_offer', template_language: 'en', status: 'sent', total_recipients: 1240, sent_count: 1236, delivered_count: 1198, read_count: 864, replied_count: 142, failed_count: 4, sending_finished_at: minutesAgo(4300) },
    { name: 'Feedback — October orders', template_name: 'feedback_request', template_language: 'en', status: 'sent', total_recipients: 380, sent_count: 380, delivered_count: 371, read_count: 302, replied_count: 97, failed_count: 0, sending_finished_at: minutesAgo(1400) },
    { name: 'New arrivals — winter range', template_name: 'festive_offer', template_language: 'en', status: 'draft', total_recipients: 0 },
  ].map((b) => ({ ...b, user_id: userId, account_id: accountId })))).error, 'campaigns');
}

async function seedAutomations(accountId, userId, tagId) {
  // Automations (event-triggered only; there are no events in a demo)
  check((await db.from('automations').insert([
    { name: 'Welcome new contacts', description: 'Send a hello and the catalogue link to anyone who messages for the first time.', trigger_type: 'first_inbound_message', trigger_config: {}, is_active: true },
    { name: 'Tag wholesale enquiries', description: 'Add the Wholesale tag when a message mentions bulk or wholesale.', trigger_type: 'keyword_match', trigger_config: { keywords: ['wholesale', 'bulk'], match_type: 'contains' }, is_active: true },
    { name: 'Route refunds to support', description: 'Assign refund conversations to the support team.', trigger_type: 'tag_added', trigger_config: { tag_id: tagId['Refund'] }, is_active: false },
  ].map((a) => ({ ...a, user_id: userId, account_id: accountId })))).error, 'automations');
}

const userId = await ensureUser();
const accountId = await workspaceFor(userId);
const { data: profile } = await db.from('profiles').select('id').eq('user_id', userId).single();
const now = new Date().toISOString();
check((await db.from('profiles').update({
  full_name: OWNER_NAME, phone: '+917000000100',
  profile_completed_at: now, walkthrough_completed_at: now,
}).eq('user_id', userId)).error, 'profile');
// Active, not trialing: no "days left" chip in screenshots, and the
// demo never expires. With no billing plan it keeps every feature.
check((await db.from('accounts').update({ name: BRAND, onboarded_at: now, subscription_status: 'active' }).eq('id', accountId)).error, 'account');
await seed(accountId, userId, profile.id);
