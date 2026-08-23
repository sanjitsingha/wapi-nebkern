-- ============================================================
-- 088 — reseed billing_plans to the Instant pricing book
--
-- The pricing spec (Starter / Growth / Business / Enterprise) replaces
-- the old Try/Pro/Business seed from 054. This migration makes the DB —
-- what checkout, onboarding and the paywall actually sell — match the
-- public /pricing page (src/lib/marketing/pricing-data.ts).
--
-- Unlike 054 (which used ON CONFLICT DO NOTHING to protect operator
-- edits), this is an authoritative reset: the operator asked for these
-- exact numbers, so it DOES UPDATE. Re-running converges on the same
-- state.
--
-- WHAT CHANGES
--   • starter  → ₹499/mo, limits users 1 / contacts 2,000, Maya OFF.
--   • growth   → NEW, ₹799/mo, featured, users 2 / contacts 5,000, Maya ON.
--   • business → ₹999/mo, users 5 / contacts 10,000, Maya ON.
--   • pro      → deactivated (superseded by growth). Existing accounts on
--                'pro' keep working: their billing_amount is a snapshot on
--                the account, and getAccountEntitlements() reads
--                billing_plans.limits by key regardless of is_active.
--   • *_yearly → seeded but is_active=false. Yearly is advertised on the
--                marketing page, but SELLING it needs an interval toggle in
--                the onboarding paywall (follow-up). Inactive rows are not
--                listed by /api/billing/plans and cannot be ordered.
--   • Enterprise is contact-sales only — intentionally NOT in this table.
--
-- Money is in MINOR units (paise). Prices exclude 18% GST (added at
-- checkout / invoicing, not stored here).
--
-- limits jsonb keys map 1:1 onto src/lib/billing/entitlements.ts. Maya is
-- not an entitlement flag there, so it is a marketing/display distinction
-- only — not enforced by this column.
-- ============================================================

-- ---- Monthly plans (the real, purchasable set) ---------------
INSERT INTO billing_plans
  (key, name, description, tagline, amount, currency, interval,
   is_active, is_featured, sort_order, features, limits)
VALUES
  (
    'starter', 'Starter',
    'For solo founders and small clinics testing WhatsApp API',
    'For solo founders and small clinics testing WhatsApp API',
    49900, 'INR', 'monthly', true, false, 1,
    '["1 user account","1 WhatsApp Business number","Up to 2,000 contacts","Live team inbox","Broadcast campaigns","Templates, tagging & REST API"]'::jsonb,
    '{"max_users":1,"max_contacts":2000,"allow_automations":true,"allow_flows":false,"allow_instagram":false,"allow_integrations":false,"allow_calling":false}'::jsonb
  ),
  (
    'growth', 'Growth',
    'For growing D2C brands, clinics, and agencies',
    'For growing D2C brands, clinics, and agencies',
    79900, 'INR', 'monthly', true, true, 2,
    '["Everything in Starter","Maya AI agent — unlimited replies*","2 users · 2 numbers · 5,000 contacts","Automations & WhatsApp Flows","Meta Ads + Shopify/CRM connectors","Analytics & priority support"]'::jsonb,
    '{"max_users":2,"max_contacts":5000,"allow_automations":true,"allow_flows":true,"allow_instagram":true,"allow_integrations":true,"allow_calling":true}'::jsonb
  ),
  (
    'business', 'Business',
    'For established brands and hospitals scaling operations',
    'For established brands and hospitals scaling operations',
    99900, 'INR', 'monthly', true, false, 3,
    '["Everything in Growth","5 users · 5 numbers · 10,000 contacts","Maya — unlimited docs + website auto-sync","Roles & granular permissions","Custom reports & data exports","Dedicated CSM · SLA-backed uptime"]'::jsonb,
    '{"max_users":5,"max_contacts":10000,"allow_automations":true,"allow_flows":true,"allow_instagram":true,"allow_integrations":true,"allow_calling":true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline     = EXCLUDED.tagline,
  amount      = EXCLUDED.amount,
  currency    = EXCLUDED.currency,
  interval    = EXCLUDED.interval,
  is_active   = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  sort_order  = EXCLUDED.sort_order,
  features    = EXCLUDED.features,
  limits      = EXCLUDED.limits;

-- ---- Yearly plans (seeded, NOT yet purchasable) --------------
-- Same limits as the monthly sibling; interval yearly; inactive until the
-- paywall grows an interval toggle. Prices = the yearly figures on the
-- pricing page (₹5,090 / ₹7,190 / ₹7,790).
INSERT INTO billing_plans
  (key, name, description, tagline, amount, currency, interval,
   is_active, is_featured, sort_order, features, limits)
VALUES
  (
    'starter_yearly', 'Starter (yearly)',
    'For solo founders and small clinics testing WhatsApp API',
    'Billed yearly — save 15%',
    509000, 'INR', 'yearly', false, false, 4,
    '["1 user account","1 WhatsApp Business number","Up to 2,000 contacts","Live team inbox","Broadcast campaigns","Templates, tagging & REST API"]'::jsonb,
    '{"max_users":1,"max_contacts":2000,"allow_automations":true,"allow_flows":false,"allow_instagram":false,"allow_integrations":false,"allow_calling":false}'::jsonb
  ),
  (
    'growth_yearly', 'Growth (yearly)',
    'For growing D2C brands, clinics, and agencies',
    'Billed yearly — save 25%',
    719000, 'INR', 'yearly', false, true, 5,
    '["Everything in Starter","Maya AI agent — unlimited replies*","2 users · 2 numbers · 5,000 contacts","Automations & WhatsApp Flows","Meta Ads + Shopify/CRM connectors","Analytics & priority support"]'::jsonb,
    '{"max_users":2,"max_contacts":5000,"allow_automations":true,"allow_flows":true,"allow_instagram":true,"allow_integrations":true,"allow_calling":true}'::jsonb
  ),
  (
    'business_yearly', 'Business (yearly)',
    'For established brands and hospitals scaling operations',
    'Billed yearly — save 35%',
    779000, 'INR', 'yearly', false, false, 6,
    '["Everything in Growth","5 users · 5 numbers · 10,000 contacts","Maya — unlimited docs + website auto-sync","Roles & granular permissions","Custom reports & data exports","Dedicated CSM · SLA-backed uptime"]'::jsonb,
    '{"max_users":5,"max_contacts":10000,"allow_automations":true,"allow_flows":true,"allow_instagram":true,"allow_integrations":true,"allow_calling":true}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline     = EXCLUDED.tagline,
  amount      = EXCLUDED.amount,
  currency    = EXCLUDED.currency,
  interval    = EXCLUDED.interval,
  is_active   = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  sort_order  = EXCLUDED.sort_order,
  features    = EXCLUDED.features,
  limits      = EXCLUDED.limits;

-- ---- Retire the old 'pro' tier -------------------------------
-- Superseded by 'growth'. Deactivated, not deleted: an account may still
-- reference it via billing_plan_key, and its limits must stay resolvable.
UPDATE billing_plans SET is_active = false WHERE key = 'pro';
