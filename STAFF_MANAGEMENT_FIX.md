# Staff Management Fix - Adding New Staff Members

## Problem
Unable to add new staff members through the Staff Dashboard.

## Root Cause Analysis

The issue has multiple potential causes:

### 1. Database Schema Missing Columns
The `staff_users` table was missing required columns that the application expects:
- `first_name`, `last_name` - For staff name display
- `department` - Determines permissions (e.g., `success_managers` gets full access)
- `roles` - Array of roles for multi-role support
- `permissions` - Array of permission strings
- `account_completed` - Whether the staff member has completed setup
- `invitation_token`, `invitation_expires` - For invitation system
- `linked_investor_id` - For staff/investor account linking
- And more...

### 2. Admin User Not Configured as Success Manager
The default admin user (`hello@accessyourplace.com`) needs `department = 'success_managers'` to see the "Add Staff" button. The button only shows when `isSuccessManager` is true.

### 3. Edge Function Missing or Incomplete
The `manage-staff` edge function needs to handle the `add_staff` action properly.

## Solution

### Step 1: Run Database Migrations

Run this SQL in your Supabase SQL Editor:

```sql
-- Add missing columns to staff_users table
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'support_team';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS account_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS invitation_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS linked_investor_id UUID;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS yp_certified BOOLEAN DEFAULT FALSE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS yp_certification_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS deactivated_by UUID;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update the admin user to be a success manager
UPDATE staff_users 
SET 
  first_name = COALESCE(first_name, 'Admin'),
  last_name = COALESCE(last_name, 'User'),
  department = 'success_managers',
  roles = ARRAY['success_managers'],
  permissions = ARRAY['all'],
  account_completed = true,
  updated_at = NOW()
WHERE email = 'hello@accessyourplace.com';

-- Create staff_certifications table if not exists
CREATE TABLE IF NOT EXISTS staff_certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff_users(id) ON DELETE CASCADE,
  certification_type TEXT NOT NULL DEFAULT 'yp_certification',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  uploaded_by UUID REFERENCES staff_users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_by UUID REFERENCES staff_users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON staff_certifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_status ON staff_certifications(status);
```

### Step 2: Deploy/Update the manage-staff Edge Function

1. Go to Supabase Dashboard > Edge Functions
2. Find or create the `manage-staff` function
3. Replace the code with the complete implementation from `MANAGE_STAFF_EDGE_FUNCTION.md`
4. Deploy the function

### Step 3: Verify the Fix

1. Log out and log back in to the Staff Dashboard
2. You should now see the "Add Staff" button in the Staff tab
3. Try adding a new staff member

## Verification Checklist

- [ ] Database columns added successfully
- [ ] Admin user has `department = 'success_managers'`
- [ ] `manage-staff` edge function deployed
- [ ] "Add Staff" button visible in Staff Dashboard
- [ ] Can successfully add a new staff member
- [ ] New staff member receives invitation email

## Troubleshooting

### "Add Staff" button not visible
- Check if logged-in user has `department = 'success_managers'`
- Run: `SELECT email, department, roles FROM staff_users WHERE email = 'your-email@example.com';`

### Error when adding staff
- Check edge function logs in Supabase Dashboard
- Verify `RESEND_API_KEY` environment variable is set for email sending
- Check if email already exists in `staff_users` table

### Staff member not receiving invitation email
- Verify `RESEND_API_KEY` is configured in edge function secrets
- Check email logs in Resend dashboard
- Verify the email address is valid

## Quick Fix SQL

If you just need to enable the "Add Staff" button for an existing user:

```sql
UPDATE staff_users 
SET 
  department = 'success_managers',
  roles = ARRAY['success_managers'],
  permissions = ARRAY['all'],
  account_completed = true
WHERE email = 'your-email@example.com';
```

Then log out and log back in.
