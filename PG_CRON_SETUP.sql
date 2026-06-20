-- ============================================================
-- PG_CRON SETUP FOR SCHEDULED EMAIL CAMPAIGNS
-- ============================================================
-- Run this script in the Supabase SQL Editor to enable
-- automatic processing of scheduled email campaigns every 5 minutes.
--
-- PREREQUISITES:
-- 1. Enable pg_cron extension in Supabase Dashboard:
--    Database → Extensions → Search "pg_cron" → Enable
-- 2. Enable pg_net extension in Supabase Dashboard:
--    Database → Extensions → Search "pg_net" → Enable
-- ============================================================

-- Step 1: Verify extensions are enabled
-- (Run this first to check if extensions are available)
SELECT 
  extname,
  extversion
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- If the above returns empty, you need to enable the extensions
-- in the Supabase Dashboard first.

-- ============================================================
-- Step 2: Create the cron job
-- ============================================================
-- This job runs every 5 minutes and calls the edge function
-- to process any scheduled campaigns that are due.

-- First, remove any existing job with the same name (if re-running)
SELECT cron.unschedule('process-scheduled-email-campaigns');

-- Create the new cron job
SELECT cron.schedule(
  'process-scheduled-email-campaigns',  -- Unique job name
  '*/5 * * * *',                         -- Cron expression: every 5 minutes
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

-- ============================================================
-- Step 3: Verify the job was created
-- ============================================================
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database,
  username
FROM cron.job 
WHERE jobname = 'process-scheduled-email-campaigns';

-- ============================================================
-- Step 4: View job execution history
-- ============================================================
-- Run this periodically to check if the job is running successfully
SELECT 
  jrd.runid,
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))::numeric(10,2) as duration_seconds
FROM cron.job j
JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname = 'process-scheduled-email-campaigns'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- ============================================================
-- MANAGEMENT COMMANDS
-- ============================================================

-- Pause the job (stop automatic execution)
-- SELECT cron.unschedule('process-scheduled-email-campaigns');

-- Resume/recreate the job
-- (Re-run the SELECT cron.schedule(...) command above)

-- Change frequency to every 10 minutes
-- SELECT cron.unschedule('process-scheduled-email-campaigns');
-- SELECT cron.schedule(
--   'process-scheduled-email-campaigns',
--   '*/10 * * * *',
--   $$ ... same command ... $$
-- );

-- ============================================================
-- MONITORING QUERIES
-- ============================================================

-- Check scheduled campaigns waiting to be processed
SELECT 
  id,
  name,
  status,
  scheduled_for,
  total_recipients,
  created_at,
  CASE 
    WHEN scheduled_for <= NOW() THEN 'OVERDUE - Should be processing'
    ELSE 'PENDING - ' || (scheduled_for - NOW())::text
  END as queue_status
FROM email_campaigns
WHERE status = 'scheduled'
ORDER BY scheduled_for ASC;

-- Check cron job execution logs
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

-- Check recent campaign completions
SELECT 
  id,
  name,
  status,
  scheduled_for,
  sent_count,
  bounced_count,
  completed_at
FROM email_campaigns
WHERE status IN ('completed', 'failed')
  AND completed_at > NOW() - INTERVAL '24 hours'
ORDER BY completed_at DESC;

-- ============================================================
-- TROUBLESHOOTING
-- ============================================================

-- If pg_cron is not working, check these:

-- 1. Verify pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Verify pg_net extension is enabled  
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 3. Check if job exists
SELECT * FROM cron.job;

-- 4. Check for failed job runs
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC 
LIMIT 10;

-- 5. Test the edge function manually
-- Run this to verify the edge function works:
SELECT net.http_post(
  url := 'https://zhobqrmkbtsqugtiahyn.supabase.co/functions/v1/process-scheduled-campaigns',
  headers := jsonb_build_object(
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);

-- 6. Check the response from the test
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
