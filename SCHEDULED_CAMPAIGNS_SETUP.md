# Scheduled Email Campaigns Setup

## Overview

The scheduled email campaigns feature allows staff to create bulk email campaigns that will be automatically sent at a specified future date and time using pg_cron for automatic processing every 5 minutes.

## Components

### 1. Frontend (BulkEmailCampaign.tsx)
- **Schedule Toggle**: Enable/disable scheduling for a campaign
- **Date/Time Picker**: Select when the campaign should be sent
- **Scheduled Queue Tab**: View all pending scheduled campaigns with countdown timers
- **Actions**: Send now, reschedule, or cancel scheduled campaigns

### 2. Edge Functions

#### manage-email-templates
Handles campaign management with these scheduling-related actions:
- `create_campaign`: Creates campaigns with optional `scheduled_for` timestamp
- `cancel_campaign`: Cancels a scheduled campaign
- `reschedule_campaign`: Updates the scheduled time for a campaign
- `send_scheduled_now`: Immediately sends a scheduled campaign
- `process_scheduled`: Processes all due scheduled campaigns (used by cron)

#### process-scheduled-campaigns
Dedicated cron job function that:
1. Queries for campaigns where `status = 'scheduled'` and `scheduled_for <= now`
2. Fetches the associated template and recipient list
3. Sends emails to all recipients
4. Updates campaign status to `completed`
5. Logs all sent emails to `email_logs` table

### 3. Database Schema

```sql
-- email_campaigns table columns for scheduling
scheduled_for TIMESTAMPTZ;  -- When the campaign should be sent
recipient_ids TEXT[];       -- Array of investor IDs to receive the campaign
status VARCHAR;             -- 'draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'
```

---

## pg_cron Setup Instructions

### Step 1: Enable Extensions in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Extensions**
3. Search for and enable these extensions:
   - **pg_cron** - For scheduling database jobs
   - **pg_net** - For making HTTP requests from PostgreSQL

Alternatively, run these in the SQL Editor with appropriate permissions:
```sql
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

### Step 2: Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key) - this is your production secret
4. Keep this key secure and never expose it in client-side code

### Step 3: Create the Cron Job

After enabling the extensions, run this SQL to create the scheduled job.

**IMPORTANT**: Replace `YOUR_SUPABASE_SERVICE_ROLE_KEY` with your actual service role key from Step 2.

```sql
-- Create a cron job to process scheduled campaigns every 5 minutes
SELECT cron.schedule(
  'process-scheduled-email-campaigns',  -- Job name
  '*/5 * * * *',                         -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://api.databasepad.com/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Step 3: Verify the Cron Job

```sql
-- Check if the cron job was created successfully
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'process-scheduled-email-campaigns';
```

Expected output:
```
jobid | jobname                           | schedule    | command
------+-----------------------------------+-------------+------------------
1     | process-scheduled-email-campaigns | */5 * * * * | SELECT net.http_post...
```

### Step 4: Monitor Cron Job Execution

```sql
-- Check recent job executions
SELECT 
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

---

## Alternative Setup Options

### Option 1: External Cron Service (cron-job.org)

If pg_cron is not available, use a free external cron service:

1. Go to https://cron-job.org
2. Create a free account
3. Add a new cron job with these settings:
   - **URL**: `https://api.databasepad.com/functions/v1/process-scheduled-campaigns`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **Request Method**: POST
   - **Headers**:
     - `Content-Type: application/json`
     - `Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
   - **Request Body**: `{}`

### Option 2: GitHub Actions Scheduled Workflow

Create `.github/workflows/process-campaigns.yml`:

```yaml
name: Process Scheduled Email Campaigns

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  process-campaigns:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Campaign Processing
        run: |
          curl -X POST \
            'https://api.databasepad.com/functions/v1/process-scheduled-campaigns' \
            -H 'Content-Type: application/json' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' \
            -d '{}'
```

**Note**: Add your service role key as a GitHub secret named `SUPABASE_SERVICE_ROLE_KEY`.

### Option 3: Supabase Database Webhook + pg_cron

Create a database function that pg_cron can call directly:

```sql
-- Create a function to process scheduled campaigns
CREATE OR REPLACE FUNCTION process_scheduled_campaigns_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Make HTTP request to edge function
  SELECT content::jsonb INTO result
  FROM net.http_post(
    url := 'https://api.databasepad.com/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  -- Log the result
  INSERT INTO cron_job_logs (job_name, result, executed_at)
  VALUES ('process-scheduled-campaigns', result, NOW());
END;
$$;

-- Schedule the function to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-email-campaigns',
  '*/5 * * * *',
  'SELECT process_scheduled_campaigns_job();'
);
```

---

## Testing

### Manual Test via cURL

```bash
curl -X POST https://api.databasepad.com/functions/v1/process-scheduled-campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}'
```

### Expected Response

```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "total_found": 2,
  "results": [
    {
      "campaign_id": "uuid-1",
      "campaign_name": "January Deal Alert",
      "status": "completed",
      "sent": 150,
      "errors": 0
    },
    {
      "campaign_id": "uuid-2", 
      "campaign_name": "New Properties Available",
      "status": "completed",
      "sent": 75,
      "errors": 2
    }
  ],
  "processed_at": "2026-01-14T15:25:00.000Z"
}
```

### Test with No Pending Campaigns

```json
{
  "success": true,
  "message": "No scheduled campaigns due for processing",
  "checked_at": "2026-01-14T15:25:00.000Z"
}
```

---

## Monitoring & Troubleshooting

### Check Scheduled Campaigns Queue

```sql
SELECT 
  id,
  name,
  status,
  scheduled_for,
  total_recipients,
  array_length(recipient_ids, 1) as recipient_count,
  created_at,
  CASE 
    WHEN scheduled_for <= NOW() THEN 'OVERDUE'
    ELSE 'PENDING'
  END as queue_status
FROM email_campaigns
WHERE status = 'scheduled'
ORDER BY scheduled_for ASC;
```

### Check Recent Campaign Results

```sql
SELECT 
  id,
  name,
  status,
  scheduled_for,
  sent_count,
  delivered_count,
  opened_count,
  bounced_count,
  completed_at,
  ROUND((delivered_count::numeric / NULLIF(sent_count, 0)) * 100, 1) as delivery_rate
FROM email_campaigns
WHERE status IN ('completed', 'failed')
ORDER BY completed_at DESC
LIMIT 10;
```

### Check Email Logs for Specific Campaign

```sql
SELECT 
  recipient_email,
  recipient_name,
  status,
  error_message,
  sent_at,
  delivered_at,
  opened_at
FROM email_logs
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY sent_at DESC;
```

### Check Cron Job Health

```sql
-- Recent job runs with status
SELECT 
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duration_seconds
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-scheduled-email-campaigns'
ORDER BY jrd.start_time DESC
LIMIT 20;
```

---

## Troubleshooting Guide

### Campaign Not Sending

1. **Check scheduled time**: Ensure `scheduled_for` time has passed
   ```sql
   SELECT id, name, scheduled_for, NOW() as current_time,
          scheduled_for <= NOW() as is_due
   FROM email_campaigns WHERE id = 'YOUR_CAMPAIGN_ID';
   ```

2. **Verify campaign status**: Must be `scheduled`
   ```sql
   SELECT id, name, status FROM email_campaigns WHERE id = 'YOUR_CAMPAIGN_ID';
   ```

3. **Check edge function logs**: Look for errors in Supabase dashboard → Edge Functions → process-scheduled-campaigns → Logs

4. **Verify Resend API key**: Ensure `RESEND_API_KEY` environment variable is set

### Cron Job Not Running

1. **Verify pg_cron is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check job exists**:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-scheduled-email-campaigns';
   ```

3. **Check for job errors**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC LIMIT 10;
   ```

### Emails Not Delivered

1. **Check email_logs for errors**:
   ```sql
   SELECT recipient_email, status, error_message 
   FROM email_logs 
   WHERE campaign_id = 'YOUR_CAMPAIGN_ID' AND status = 'failed';
   ```

2. **Verify recipient emails**: Ensure email addresses are valid

3. **Check Resend dashboard**: View delivery status at https://resend.com/emails

4. **Verify sending domain**: Ensure accessyourplace.com is verified in Resend

### pg_net Request Failures

1. **Check pg_net is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Test HTTP request manually**:
   ```sql
   SELECT net.http_post(
     url := 'https://api.databasepad.com/functions/v1/process-scheduled-campaigns',
     headers := '{"Content-Type": "application/json"}'::jsonb,
     body := '{}'::jsonb
   );
   ```

---

## Cron Schedule Reference

| Schedule | Description |
|----------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `0 * * * *` | Every hour |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * *` | Daily at 9 AM UTC |
| `0 9 * * 1-5` | Weekdays at 9 AM UTC |

---

## Managing the Cron Job

### Pause the Job
```sql
SELECT cron.unschedule('process-scheduled-email-campaigns');
```

### Resume/Recreate the Job
```sql
SELECT cron.schedule(
  'process-scheduled-email-campaigns',
  '*/5 * * * *',
  $$SELECT net.http_post(...);$$
);
```

### Change Schedule Frequency
```sql
-- First unschedule
SELECT cron.unschedule('process-scheduled-email-campaigns');

-- Then reschedule with new frequency (e.g., every 10 minutes)
SELECT cron.schedule(
  'process-scheduled-email-campaigns',
  '*/10 * * * *',
  $$SELECT net.http_post(...);$$
);
```

---

## Security Best Practices

1. **Never commit service role keys to version control** - Use environment variables or secrets management
2. **Rotate keys periodically** - Update the cron job SQL when rotating keys
3. **Monitor for unauthorized access** - Check edge function logs regularly
4. **Use IP allowlisting if possible** - Restrict edge function access to known IPs
