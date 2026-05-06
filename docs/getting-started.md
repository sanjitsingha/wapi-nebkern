# Getting started

Run the template locally in about 15 minutes. This guide assumes Node.js 20+ and
npm are already installed.

## 1. Fork and clone

1. Go to <https://github.com/ArnasDon/wacrm> and click **Fork** (top right).
2. Clone your fork:

   ```bash
   git clone https://github.com/<your-username>/wacrm.git
   cd wacrm
   ```

## 2. Install dependencies

```bash
npm install
```

## 3. Create the environment file

Copy the template and fill in the values (full reference in
[environment-variables.md](./environment-variables.md)):

```bash
cp .env.local.example .env.local
```

You cannot run `npm run dev` until **at least** `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. You need the full Supabase
setup before WhatsApp features will work, so do that next.

## 4. Set up Supabase

Follow [supabase-setup.md](./supabase-setup.md) to create the project and
run the migrations. Come back here when the URL, anon key, and service-role
key are populated in `.env.local`.

## 5. Generate the encryption key

Access tokens for WhatsApp are encrypted at rest with AES-256-CBC. Generate
a 64-character hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `ENCRYPTION_KEY` in `.env.local`. **Do not change
this value later** — existing tokens are encrypted with whatever value was
set at the time, and rotating it will make them unreadable.

## 6. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You should see the marketing landing page.

- Create an account at `/signup`.
- After sign-in you land on `/dashboard`.
- The inbox, contacts, pipelines, automations, and broadcasts modules are
  all empty until you connect a WhatsApp number
  ([whatsapp-setup.md](./whatsapp-setup.md)).

## 7. Commands cheat sheet

| Command          | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `npm run dev`    | Dev server with Turbopack HMR on `:3000`.      |
| `npm run build`  | Production build.                              |
| `npm start`      | Run the production build.                      |
| `npm run lint`   | ESLint across the project.                     |

## Next step

[Supabase setup →](./supabase-setup.md)
