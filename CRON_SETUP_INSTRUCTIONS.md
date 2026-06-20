# Scheduled Email Campaigns - Cron Job Setup Instructions

I don't have direct access to your Supabase Dashboard, but here are the exact step-by-step instructions to enable the scheduled email campaign processing:

---

## Step 1: Enable Required Extensions

### Enable pg_cron Extension

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Database** → **Extensions** (in the left sidebar)
4. Search for `pg_cron`
5. Click the toggle to **Enable** the extension
6. Wait for it to finish enabling (may take a few seconds)

### Enable pg_net Extension

1. Stay on the **Database** → **Extensions** page
2. Search for `pg_net`
3. Click the toggle to **Enable** the extension
4. Wait for it to finish enabling

---

## Step 2: Run the Setup SQL

1. Navigate to **SQL Editor** in the left sidebar
2. Click **New Query**
3. Copy and paste the following SQL:

```sql
-- ============================================================
-- VERIFY EXTENSIONS ARE ENABLED
-- ============================================================
SELECT 
  extname,
  extversion
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- You should see both pg_cron and pg_net in the results.
-- If not, go back to Step 1 and enable them.
```

4. Click **Run** to verify extensions are enabled
5. You should see both `pg_cron` and `pg_net` in the results

---

## Step 3: Create the Cron Job

1. In the **SQL Editor**, create a new query
2. Copy and paste the following SQL:

```sql
-- Remove any existing job with the same name (safe to run even if it doesn't exist)
SELECT cron.unschedule('process-scheduled-email-campaigns');

-- Create the cron job to run every 5 minutes
SELECT cron.schedule(
  'process-scheduled-email-campaigns',  -- Unique job name
  '*/5 * * * *',                         -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://zhobqrmkbtsqugtiahyn.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpob2Jxcm1rYnRzcXVndGlhaHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEzNzY0NzIsImV4cCI6MjA0Njk1MjQ3Mn0.JNTVjtPFZCYIGoWfJn3ZVmhPLxjyIpHhqgbNdXCOqkQ'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

3. Click **Run**
4. You should see a success message

---

## Step 4: Verify the Job Was Created

1. Run this query to confirm the job exists:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database,
  username
FROM cron.job 
WHERE jobname = 'process-scheduled-email-campaigns';
```

2. You should see one row with:
   - `jobname`: `process-scheduled-email-campaigns`
   - `schedule`: `*/5 * * * *`
   - `active`: `true`

---

## Step 5: Test the Setup

### Option A: Wait for Automatic Execution
- The job will run automatically every 5 minutes
- Check back in 5-10 minutes to see execution history

### Option B: Test Manually
Run this query to manually trigger the edge function:

```sql
SELECT net.http_post(
  url := 'https://zhobqrmkbtsqugtiahyn.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

Then check the response:

```sql
SELECT 
  id,
  status_code,
  content::text as response_body,
  created
FROM net._http_response 
ORDER BY created DESC 
LIMIT 1;
```

---

## Monitoring Commands

### Check Job Execution History

```sql
SELECT 
  jrd.runid,
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-scheduled-email-campaigns'
ORDER BY jrd.start_time DESC
LIMIT 20;
```

### Check Scheduled Campaigns Queue

```sql
SELECT 
  id,
  name,
  status,
  scheduled_for,
  total_recipients,
  CASE 
    WHEN scheduled_for <= NOW() THEN 'OVERDUE'
    ELSE 'PENDING'
  END as queue_status
FROM email_campaigns
WHERE status = 'scheduled'
ORDER BY scheduled_for ASC;
```

### Check Application Logs

```sql
SELECT 
  id,
  job_name,
  status,
  result,
  error_message,
  executed_at,
  duration_ms
FROM cron_job_logs
WHERE job_name = 'process-scheduled-campaigns'
ORDER BY executed_at DESC
LIMIT 20;
```

---

## Management Commands

### Pause the Job
```sql
SELECT cron.unschedule('process-scheduled-email-campaigns');
```

### Change Frequency to Every 10 Minutes
```sql
SELECT cron.unschedule('process-scheduled-email-campaigns');

SELECT cron.schedule(
  'process-scheduled-email-campaigns',
  '*/10 * * * *',  -- Changed to every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://zhobqrmkbtsqugtiahyn.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpob2Jxcm1rYnRzcXVndGlhaHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEzNzY0NzIsImV4cCI6MjA0Njk1MjQ3Mn0.JNTVjtPFZCYIGoWfJn3ZVmhPLxjyIpHhqgbNdXCOqkQ'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Change Frequency to Every 1 Minute (for testing)
```sql
SELECT cron.unschedule('process-scheduled-email-campaigns');

SELECT cron.schedule(
  'process-scheduled-email-campaigns',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://zhobqrmkbtsqugtiahyn.supabase.co/functions/v1/process-scheduled-campaigns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpob2Jxcm1rYnRzcXVndGlhaHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEzNzY0NzIsImV4cCI6MjA0Njk1MjQ3Mn0.JNTVjtPFZCYIGoWfJn3ZVmhPLxjyIpHhqgbNdXCOqkQ'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Troubleshooting

### Job Not Running?

1. **Check if extensions are enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```

2. **Check if job exists:**
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Check for failed runs:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status = 'failed' 
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

### Edge Function Errors?

Check the Supabase Edge Function logs:
1. Go to **Edge Functions** in the dashboard
2. Click on `process-scheduled-campaigns`
3. View the **Logs** tab

---

## Cron Schedule Reference

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `*/10 * * * *` | Every 10 minutes |
| `*/15 * * * *` | Every 15 minutes |
| `0 * * * *` | Every hour (on the hour) |
| `0 */2 * * *` | Every 2 hours |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * *` | Daily at 9 AM |
| `0 9 * * 1` | Every Monday at 9 AM |

---

## Summary

Once you complete these steps:

1. ✅ pg_cron extension enabled
2. ✅ pg_net extension enabled  
3. ✅ Cron job created and running every 5 minutes
4. ✅ Scheduled email campaigns will automatically send at their designated times

The system will check every 5 minutes for any campaigns where `scheduled_for <= NOW()` and `status = 'scheduled'`, then process and send them automatically.
