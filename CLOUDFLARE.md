# Cloudflare Pages deployment

This app uses Next.js with the OpenNext Cloudflare adapter. Cloudflare Pages must
run the adapter build, not `next build` alone: `next build` produces `.next`,
while Pages serves the adapter output in `.open-next`.

## Pages build settings

In **Settings → Builds & deployments → Build configuration**, use:

- **Build command:** `npm run pages:build`
- **Build output directory:** `.open-next`
- **Root directory:** `/` (repository root)
- **Node.js version:** 22 or newer (the supplied Cloudflare build log uses Node 22)

The `pages:build` script invokes `opennextjs-cloudflare build`. Do not configure
`npm run build` as the Pages build command; that only runs `next build` and does
not produce the deployable OpenNext output.

## Environment variables

Add the app's production variables in Cloudflare Pages under **Settings →
Environment variables** for both **Production** and **Preview** as appropriate.
At minimum, configure:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED` (needed for the schema push command, not normal requests)
- `NEON_STORAGE_BUCKET`
- `AWS_ENDPOINT_URL_S3`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

The supplied build log reports **“Build environment variables: (none found)”**.
The Clerk keys and runtime database/storage variables must be added in the
Cloudflare project before expecting sign-in and data features to work. Do not
commit secret values to this repository.

## Wrangler configuration and deployment

`wrangler.toml` targets the generated `.open-next` directory and enables
`nodejs_compat`. Keep the Cloudflare Pages output directory in sync with that
value. After a successful build, deploy with `npm run deploy:cf`; for a local
Pages preview, use `npm run preview`.

The repository currently uses Next.js 16 and React 19. The ESLint 9 deprecation
message in the build output is a tooling warning, not the cause of the Pages
build stopping. Review the first error after the build output's last line if the
adapter build still fails.
