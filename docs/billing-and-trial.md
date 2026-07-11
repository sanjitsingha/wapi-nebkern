# Billing, Plans & Free Trial — Design

Status: **Design / planning.** Only the **14-day free trial** is being executed now.
Paid plans and payment-provider integration are documented here but **deferred**.

---

## 1. Goals & scope

- Every new account starts on a **14-day free trial** with full access.
- Later: **2–3 paid plans** (e.g. Starter / Pro / Business) with feature limits, plus
  a payment provider (Stripe or Razorpay) for checkout and renewals.
- **Now (this pass): the trial only** — start it on signup, show days-remaining,
  detect expiry, and gate the app when the trial ends. No checkout, no paid plans.

Non-goals for this pass: payment collection, proration, invoices, webhooks from a
payment provider, per-plan quota enforcement.

---

## 2. Where this plugs into the existing architecture

The app is already multi-tenant, one **`accounts`** row per owner (migration 017):

- `accounts (id, name, owner_user_id, created_at, updated_at)`.
- New signups are bootstrapped atomically by the `handle_new_user()` trigger
  (creates the account + owner profile).
- Tenancy is enforced by `is_account_member(account_id, min_role)` in RLS.
- Server code reads context via `getCurrentAccount()` / `requireRole()`
  (`src/lib/auth/account.ts`).
- Client reads it via `useAuth()` → `account` (`AccountSummary`) in
  `src/hooks/use-auth.tsx`.

**The subscription is a property of the `account`.** That's the natural home:
one subscription per tenant, already the unit everything else is scoped to.

---

## 3. Data model

### 3.1 Columns on `accounts` (this pass)

```sql
-- subscription_status_enum: the lifecycle states
CREATE TYPE subscription_status_enum AS ENUM (
  'trialing',   -- inside the free-trial window
  'active',     -- paid & current (also used for grandfathered accounts)
  'past_due',   -- payment failed, grace period (paid plans, later)
  'canceled',   -- user canceled; access until period end
  'expired'     -- trial ended (or subscription lapsed) with no active plan
);

ALTER TABLE accounts
  ADD COLUMN plan                TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN subscription_status subscription_status_enum NOT NULL DEFAULT 'trialing',
  ADD COLUMN trial_started_at    TIMESTAMPTZ,
  ADD COLUMN trial_ends_at       TIMESTAMPTZ;
```

`plan` is a free-text key now (`'trial'`), becomes a plan id (`'starter'`, `'pro'`, …)
when paid plans land.

### 3.2 Columns deferred to the paid-plans pass

```sql
-- payment-provider linkage (added when checkout is built)
ALTER TABLE accounts
  ADD COLUMN current_period_end     TIMESTAMPTZ,  -- paid renewal boundary
  ADD COLUMN provider_customer_id   TEXT,         -- e.g. Stripe customer
  ADD COLUMN provider_subscription_id TEXT;
```

A dedicated `subscription_events` audit table (provider webhook log) is also a
paid-plans concern; not now.

### 3.3 Plan definitions live in **code**, not the DB

Plans are a small, versioned constant — cheaper to reason about and diff than DB
rows, and there are only a handful. Proposed shape (finalize limits later):

```ts
// src/lib/billing/plans.ts  (paid limits are PLACEHOLDERS)
export interface Plan {
  id: 'trial' | 'starter' | 'pro' | 'business';
  name: string;
  priceMonthly: number | null;   // null = trial
  limits: {
    contacts: number | null;     // null = unlimited
    teamMembers: number | null;
    broadcastsPerMonth: number | null;
    aiReplies: boolean;
    channels: ('whatsapp' | 'instagram')[];
  };
}
```

During the trial, the effective limits are the **top paid tier** (full access).

---

## 4. Trial mechanics (this pass)

1. **Start on signup.** Extend `handle_new_user()` to set, on the new account:
   `plan='trial'`, `subscription_status='trialing'`,
   `trial_started_at=now()`, `trial_ends_at=now() + interval '14 days'`.
2. **Existing accounts (backfill).** Pre-launch there are no paying customers, so
   backfill existing accounts to **`active`** (grandfathered) so dev/testing isn't
   trapped in an expired trial. *(Open decision — see §8.)*
3. **Source of truth = compute-on-read.** The effective state is derived whenever
   we read it: if `status='trialing'` and `trial_ends_at < now()`, treat it as
   **expired**. This avoids depending on a cron for correctness.
4. **Optional cron (nice-to-have).** A daily job flips lapsed `trialing` rows to
   `expired` so reporting/queries are clean. Not required for enforcement.
5. **Days remaining** = `ceil((trial_ends_at - now) / 1 day)`, floored at 0.

---

## 5. Enforcement

### 5.1 Effective-state helper (server + shared)

```ts
// src/lib/billing/subscription.ts
export type EffectiveStatus = 'trialing' | 'active' | 'expired' | 'past_due' | 'canceled';

export interface SubscriptionState {
  status: EffectiveStatus;   // computed (trial expiry folded in)
  plan: string;
  isTrial: boolean;
  trialDaysLeft: number;     // 0 when not trialing
  trialEndsAt: string | null;
  hasAccess: boolean;        // trialing | active  → true
}

export function computeSubscription(account: AccountRow): SubscriptionState { … }
```

### 5.2 Gate policy (what "expired" blocks)

Because there is **no checkout yet**, a hard paywall would lock users out with no
way to pay. Recommended for this pass:

- **Read stays available.** Users can still see their data.
- **Costly / outward actions are blocked** when `!hasAccess`: sending messages,
  launching broadcasts, running automations/flows that send. These already funnel
  through a few server routes (`/api/whatsapp/send`, `/api/whatsapp/broadcast`,
  the automations/flows senders), so a single `requireActiveSubscription()` guard
  covers them.
- A persistent, non-dismissible **"trial ended"** banner points to "choose a plan"
  (which is a stub until checkout ships).

*(This strictness is an open decision — see §8.)*

```ts
// implemented: src/lib/billing/guard.ts
export async function assertActiveSubscription(
  supabase, accountId,
): Promise<NextResponse | null> { … }   // 402 when !hasAccess, null when OK
```

**Applied to (this pass):** `POST /api/whatsapp/send`, `POST /api/whatsapp/broadcast`
— the two user-initiated send paths. Both call `assertActiveSubscription` right
after resolving `accountId` and return a `402 { code: 'subscription_required' }`
when the trial has expired.

**Known gap (follow-up):** background senders — AI auto-reply, automations, and
flows — run under the service-role client from the webhook/cron, not these routes,
so they are **not yet gated**. Gating them means calling the same check inside those
service-role senders (keyed by the row's `account_id`). Deferred to keep this pass
off the flow/automation engine; tracked here so it isn't forgotten.

### 5.3 Client surface

- `<TrialBanner/>` in `dashboard-shell.tsx` fetches its own state from
  `GET /api/account/subscription`: "N days left in your trial" during the trial;
  a red "trial ended" bar when expired; nothing when active.
- **Decoupled on purpose.** The banner does NOT read the subscription through
  `useAuth`'s core profile query. An earlier attempt to add the four columns to the
  `account:accounts!inner(...)` join broke the *entire* app before migration 051 was
  applied (the join referenced non-existent columns, so `fetchProfile` failed and no
  profile loaded). Fetching via the tolerant API endpoint instead means a missing
  migration degrades to "no banner", never a broken auth path.

---

## 6. Paid plans (deferred — documented for direction)

- 2–3 tiers (Starter / Pro / Business) defined in `src/lib/billing/plans.ts`.
- A **Settings → Plan & billing** panel (new settings section) showing the current
  plan, trial status, and an upgrade CTA.
- **Checkout** via Stripe or Razorpay (Razorpay if India-first, given the WhatsApp
  audience). Provider webhooks update `subscription_status` / `current_period_end`.
- Per-plan **quota enforcement** (contacts, team size, broadcasts/month) layered on
  top of the same `requireActiveSubscription()` seam.

---

## 7. Execution plan — TRIAL ONLY (this pass)

Phased, smallest-risk first:

1. **Migration `051_account_trial.sql`**
   - Create `subscription_status_enum`.
   - Add the four columns (§3.1).
   - Backfill existing accounts → `active` (grandfathered).
   - Replace `handle_new_user()` to set trial fields on new accounts.
2. **Shared lib `src/lib/billing/subscription.ts`** — `computeSubscription()` +
   types (pure, unit-testable).
3. **Client wiring** — extend `AccountSummary` + `fetchProfile` select in
   `use-auth.tsx`; expose `subscription`.
4. **`<TrialBanner/>`** in `dashboard-shell.tsx`.
5. **API `GET /api/account/subscription`** — returns the computed state (for the
   banner / future billing page; also the server source of truth).
6. **Server guard `requireActiveSubscription()`** + apply to the send/broadcast
   routes *(only if we choose to gate now — see §8)*.

Steps 1–4 give a visible, working trial countdown. 5–6 add enforcement.

---

## 8. Decisions (resolved)

1. **Existing accounts:** ✅ grandfather to `active` — new signups get the trial.
2. **Expiry strictness now:** ✅ block sends/broadcasts on expiry via
   `requireActiveSubscription()`; app stays readable; "trial ended" banner shown.
3. **Trial length:** ✅ 14 days (kept as a single const for easy change).
```
