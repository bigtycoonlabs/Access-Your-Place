# Development Setup for Access Your Place

This repository uses Vite + React + TypeScript, with Supabase and Stripe integration.

## Getting started

1. Copy `.env.example` to `.env` in the project root and fill in the real values for:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLIC_KEY`
   - `VITE_STRIPE_SECRET_KEY`

2. Install dependencies:

```
npm install
```

3. Start the dev server:

```
npm run dev
```

This project currently relies on Supabase for authentication and backend data. Make sure to create a Supabase project and configure the URL and anon key accordingly.

Railway is used for deploying the backend (Edge functions). Ensure you have a Railway account and set environment variables for Supabase and Stripe there as well.
