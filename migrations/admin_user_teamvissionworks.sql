-- ============================================================
--  Admin User: teamvissionworks@gmail.com
--  Run once in Supabase SQL Editor → New Query → Run
--
--  Temporary password: TempAdmin2024!
--  Hash: SHA-256("TempAdmin2024!" + "ayp_staff_salt_2024")
--  CHANGE PASSWORD IMMEDIATELY after first login via Staff Dashboard → Profile
-- ============================================================

INSERT INTO staff_users (
  id,
  email,
  first_name,
  last_name,
  name,
  department,
  role,
  roles,
  permissions,
  password_hash,
  is_active,
  account_completed,
  yp_certified,
  team,
  notification_preferences,
  failed_login_attempts,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'teamvissionworks@gmail.com',
  'Admin',
  'TeamVission',
  'Admin TeamVission',
  'success_managers',
  'admin',
  ARRAY['admin', 'success_manager', 'staff'],
  ARRAY['all', 'admin', 'manage_staff', 'manage_investors', 'manage_properties',
        'manage_deals', 'manage_billing', 'manage_settings', 'view_analytics',
        'manage_agreements', 'manage_crm', 'manage_hr', 'send_notifications'],
  'e4267bce9a1978d15616ed8913b97eda49ebcf6686395aa782eff766defbdca4', -- TempAdmin2024!
  true,
  true,
  true,
  'leadership',
  '{"email": true, "sms": false, "push": true}'::jsonb,
  0,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  role        = EXCLUDED.role,
  roles       = EXCLUDED.roles,
  permissions = EXCLUDED.permissions,
  department  = EXCLUDED.department,
  is_active   = true,
  account_completed = true,
  updated_at  = now();

-- Verify the insert
SELECT id, email, role, department, permissions, is_active
FROM staff_users
WHERE email = 'teamvissionworks@gmail.com';
