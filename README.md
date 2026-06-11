This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Inngest Dev Server (background jobs)

Product sync and retention sweeps run as [Inngest](https://www.inngest.com) functions. In local development, events are only delivered when the Inngest dev server is running alongside `bun dev`.

1. Make sure `.env` contains `INNGEST_DEV=1` (see `.env.example`). Without it the SDK targets Inngest Cloud and `inngest.send()` fails with "couldn't find an event key".

2. Start the dev server in a separate terminal:

   ```bash
   NPM_CONFIG_CACHE=$(mktemp -d) npx -y --ignore-scripts=false inngest-cli@latest dev
   ```

   > Note: plain `bunx inngest-cli` does not work — bun skips the postinstall script that downloads the CLI binary, hence the `npx --ignore-scripts=false` form.

3. Open the dev server UI at [http://localhost:8288](http://localhost:8288). With `bun dev` running, it auto-discovers the app's functions at `http://localhost:3000/api/inngest`.

In production no dev server is needed: leave `INNGEST_DEV` unset and provide `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (auto-set by the Vercel ↔ Inngest marketplace integration).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
