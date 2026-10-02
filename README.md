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

## Environment Configuration

Set these values in `.env` for local development and in the deployment platform's environment settings for production:

```env
DATABASE_URL="your-postgresql-connection-string"
NEXTAUTH_SECRET="a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="authorized-admin@example.com"
ADMIN_REGISTRATION_CODE="a-private-admin-registration-code"
RESEND_API_KEY="your-resend-api-key"
VAPID_SUBJECT="mailto:admin@example.com"
VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
```

Keep secret values out of source control. Admin registration only grants the `ADMIN` role when both the email and registration code match the server-side environment values. Admin APIs also verify the signed session and role.

Generate a VAPID key pair for Web Push with `npx web-push generate-vapid-keys` and configure all three VAPID values locally and in production. Web Push requires HTTPS in production; localhost is supported for local development. Apply the Web Push subscription migration with `npx prisma migrate deploy` before deploying the app. Existing databases were baselined at `20260927000000_init`; later schema changes should be added as new Prisma migrations.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
