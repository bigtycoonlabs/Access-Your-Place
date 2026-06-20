# Complete Setup Instructions

## Step 1: Database Setup

1. Go to your Supabase Dashboard → SQL Editor
2. Run the SQL from `DATABASE_SCHEMA.sql` to create the required tables
3. Verify tables were created in Table Editor

## Step 2: Environment Variables

Add these to your Supabase Edge Functions environment:

```bash
ANTHROPIC_API_KEY=your_claude_api_key_here
```

Set in Supabase Dashboard → Edge Functions → Settings

## Step 3: Deploy Edge Functions

You need to deploy 4 edge functions. See `EDGE_FUNCTIONS_SETUP.md` for the complete code.

### Required Functions:
1. **daily-article-generation** - Generates 10 articles from queue
2. **discover-trending-topics** - Scrapes web for trending topics
3. **check-topic-similarity** - AI deduplication
4. **monitor-regulation-feeds** - Tracks regulation changes

### Deploy via Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy each function
supabase functions deploy daily-article-generation
supabase functions deploy discover-trending-topics
supabase functions deploy check-topic-similarity
supabase functions deploy monitor-regulation-feeds
```

## Step 4: GitHub Actions Setup

The cron jobs are configured in `.github/workflows/daily-cron.yml`

### Setup GitHub Secrets:

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key from Supabase

### Schedule:
- Topic Discovery: 6 AM EST Monday-Friday
- Article Generation: 7 AM EST Monday-Friday

## Step 5: Test the System

1. Go to Staff Dashboard → Topics tab
2. Click "Discover Topics" to test topic scraping
3. Click "Generate 10 Articles" to test article generation
4. Check the Blog Articles tab for generated content

## Troubleshooting

### "Edge Function returned non-2xx status"
- Edge functions not deployed yet
- Check Supabase Dashboard → Edge Functions for errors
- Verify environment variables are set

### No topics discovered
- Check edge function logs in Supabase
- Verify API keys are correct
- Test web scraping endpoints manually

### Articles not generating
- Ensure research_queue has topics
- Check ANTHROPIC_API_KEY is set
- Review edge function logs
