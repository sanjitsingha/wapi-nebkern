# WhatsApp setup

This template talks to the official **WhatsApp Business Cloud API** (Meta). Each
account stores its own `phone_number_id`, `waba_id`, and encrypted
`access_token` — there is no shared app-level token. This page walks
through getting those values and wiring the webhook.

## 1. Prerequisites

- A [Meta for Developers](https://developers.facebook.com) account.
- A Meta **Business Manager** account.
- A phone number that is **not** already in use on the regular WhatsApp or
  WhatsApp Business mobile apps. Landlines work; the number must be able
  to receive an SMS or voice call during verification.

## 2. Create the Meta app

1. In Meta for Developers, go to **My Apps → Create App**.
2. Pick the **Business** app type.
3. On the dashboard, under **Add products**, click **Set up** on
   **WhatsApp**.
4. Connect your Business Manager and accept the terms.

Meta gives you a **test number** for free. You can use it for local
testing, but for production you need to add your own number under
**WhatsApp → API Setup → From**.

## 3. Collect the IDs and the token

On **WhatsApp → API Setup** you will see:

| Value                 | Goes into                                        |
| --------------------- | ------------------------------------------------ |
| Phone number ID       | `phone_number_id` (entered in Settings → Connect) |
| WhatsApp Business ID  | `waba_id` (optional but recommended)              |
| Temporary access token | `access_token` (short-lived — see next step)      |

The temporary token expires after 24 hours. For production you must
generate a **System User** access token:

1. **Business Settings → Users → System users → Add**.
2. Name it `wacrm-system-user`, role **Admin**.
3. Click **Generate new token**, pick the app, and grant:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. Copy the token. **This is shown only once.**

## 4. Connect it inside the app

1. Run the app locally (or open your deployed instance).
2. Sign in, then go to **Settings → WhatsApp**.
3. Fill in:
   - **Phone number ID** — from step 3.
   - **WhatsApp Business ID** — optional.
   - **Access token** — the System User token from step 3.
   - **Verify token** — any random string you make up; you will paste the
     same value into Meta in the next step.
4. Save. The app encrypts the access token and verify token with your
   `ENCRYPTION_KEY` before writing them to Supabase.

## 5. Configure the webhook in Meta

Under **WhatsApp → Configuration → Webhook**:

- **Callback URL**:
  - Local dev: run `npx ngrok http 3000` (or similar) and paste
    `https://<your-subdomain>.ngrok.app/api/whatsapp/webhook`.
  - Production: `https://<your-domain>/api/whatsapp/webhook`.
- **Verify token**: the same string you entered in step 4.
- Click **Verify and save**. Meta sends a GET with
  `hub.challenge` — the app's webhook route decrypts stored verify tokens
  and echoes the challenge back. If verification fails, double-check the
  verify token matches and the callback URL is publicly reachable.

### Subscribe to events

Under the webhook config, **Subscribe to** at minimum:

- `messages`
- `message_template_status_update`

`messages` delivers inbound messages and delivery / read statuses;
`message_template_status_update` keeps Meta-approved template statuses in
sync on the broadcast UI.

## 6. Signature verification (required)

Set `META_APP_SECRET` to your app's **App Secret** (Meta for Developers →
App Settings → Basic). The app validates the `X-Hub-Signature-256` HMAC
on every inbound webhook and **rejects every request if the env var is
not set** — anyone who knew the webhook URL could otherwise spoof
messages and status updates. Configure it before pointing the webhook
at a deployed instance.

## 7. Send a test message

1. From Meta's **API Setup** page, send a test message to a number that is
   a registered tester.
2. Watch the Inbox — the message should appear within a second or two.
3. Reply from the app; the recipient gets a real WhatsApp message.

If nothing shows up, see [troubleshooting.md](./troubleshooting.md).

## Next step

[Environment variables →](./environment-variables.md)
