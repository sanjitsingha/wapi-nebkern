# Instant's HubSpot app

This folder is a HubSpot developer project. It defines the one HubSpot
app every Instant account connects through: its redirect URL, scopes
and webhook subscriptions. It is uploaded to HubSpot once; it is not
part of the Next.js build.

It has to agree with the code:

| Here | In the code |
| --- | --- |
| `requiredScopes` in `src/app/app-hsmeta.json` | `HUBSPOT_SCOPES` in `src/lib/hubspot/client.ts` |
| `redirectUrls` | `hubspotRedirectUri()` — `NEXT_PUBLIC_SITE_URL` + `/api/integrations/hubspot/oauth/callback` |
| `targetUrl` in `src/app/webhooks/webhooks-hsmeta.json` | `src/app/api/integrations/hubspot/webhook/route.ts` |
| the webhook subscriptions | `HUBSPOT_EVENTS` in `src/lib/hubspot/events.ts` |

## Setting it up (once)

1. Create a free developer account at <https://developers.hubspot.com>.
2. Install the CLI and sign in to that account:

   ```sh
   npm install -g @hubspot/cli@latest
   hs account auth
   ```

3. Upload this project:

   ```sh
   cd hubspot
   hs project upload
   ```

   If the CLI rejects `platformVersion` in `hsproject.json`, run
   `hs project create` (choose **App**) in an empty folder, and copy
   `app-hsmeta.json` and `webhooks/webhooks-hsmeta.json` from here into
   what it generates.

4. `hs project open` → click the app → **Auth** tab → copy the
   **Client ID** and **Client secret**.
5. On the server, add them to `.env.local` (never into chat or git):

   ```
   HUBSPOT_CLIENT_ID=…
   HUBSPOT_CLIENT_SECRET=…
   ```

   then restart the app. Settings → Integrations → HubSpot now connects.

## Changing it

Edit the JSON and run `hs project upload` again. A new scope also needs
adding to `HUBSPOT_SCOPES`, and existing connections must reconnect to
grant it — Settings asks them to.

An app that is not listed on the HubSpot Marketplace can only be
installed by a limited number of HubSpot accounts. Check the current
limit in the app's settings, and submit the app for listing before
rolling it out to every customer.
