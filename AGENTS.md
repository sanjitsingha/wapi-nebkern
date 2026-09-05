<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## `npm run build` uses Webpack on purpose

`build` is `next build --webpack`, not the Next 16 default of Turbopack.
Do not "modernise" it back.

Turbopack rewrites externalised packages to a content-hashed specifier
derived from the `node_modules` tree present at build time, and emits a
literal `require("@aws-sdk/client-s3-ecbef8e33fd0b8f0")` into the server
chunk. Nothing by that name exists on disk, so the moment the build runs
against a different tree than the runtime — which is always here, since
we build on the workstation and ship `.next` to a server that has run
`npm prune --omit=dev` — every R2 upload dies with:

    Failed to load external module @aws-sdk/client-s3-<hash>:
    Cannot find module '@aws-sdk/client-s3-<hash>'

That is vercel/next.js#87737. Adding the packages to
`serverExternalPackages` does not fix it and made it worse (the
presigner got hashed too). Webpack emits a plain
`require("@aws-sdk/client-s3")` and works.

After any build, this must print nothing:

    grep -rhoE "node_modules/[@a-z0-9._/-]+-[0-9a-f]{16}" .next/server

Anything it prints is the next feature about to break in production.
Revisit when the upstream issue closes.
