-- Core tables for Access Your Place Platform

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff users table for authentication (COMPLETE)
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  team TEXT DEFAULT 'Operations',
  role TEXT DEFAULT 'staff',
  department TEXT DEFAULT 'support_team',
  roles TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  account_completed BOOLEAN DEFAULT FALSE,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  invitation_token TEXT,
  invitation_expires TIMESTAMP WITH TIME ZONE,
  linked_investor_id UUID,
  last_login TIMESTAMP WITH TIME ZONE,
  yp_certified BOOLEAN DEFAULT FALSE,
  yp_certification_verified BOOLEAN DEFAULT FALSE,
  deactivated_by UUID,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff certifications table
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

CREATE INDEX IF NOT EXISTS idx_staff_certifications_staff ON staff_certifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_certifications_status ON staff_certifications(status);

-- Staff messages table
CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES staff_users(id),
  recipient_id UUID REFERENCES staff_users(id),
  subject TEXT,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_recipient ON staff_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_read ON staff_messages(read);

-- AM assignment requests table
CREATE TABLE IF NOT EXISTS am_assignment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID,
  status TEXT DEFAULT 'pending',
  assigned_am_id UUID REFERENCES staff_users(id),
  matched_by UUID REFERENCES staff_users(id),
  matched_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES staff_users(id),
  rejection_reason TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_am_assignment_requests_status ON am_assignment_requests(status);

-- AM change requests table
CREATE TABLE IF NOT EXISTS am_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID,
  current_am_id UUID REFERENCES staff_users(id),
  requested_am_id UUID REFERENCES staff_users(id),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES staff_users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES staff_users(id),
  rejection_reason TEXT,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_am_change_requests_status ON am_change_requests(status);



-- Investors table (COMPLETE)
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  portfolio_count INTEGER DEFAULT 0,
  investment_budget_min DECIMAL,
  investment_budget_max DECIMAL,
  preferred_markets TEXT[] DEFAULT '{}',
  preferred_operation_types TEXT[] DEFAULT '{}',
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_type TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  description TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_type TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES investors(id),
  referred_email TEXT,
  referred_id UUID REFERENCES investors(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID REFERENCES referrals(id),
  investor_id UUID REFERENCES investors(id),
  amount DECIMAL DEFAULT 300,
  reward_type TEXT DEFAULT 'pending_choice',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investor favorites table
CREATE TABLE IF NOT EXISTS investor_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID REFERENCES investors(id),
  property_id UUID,
  property_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_favorites_investor ON investor_favorites(investor_id);

-- Insert default staff user with password VigVission55!
-- BCrypt hash for VigVission55!
INSERT INTO staff_users (
  email, password_hash, name, first_name, last_name, team, role, 
  department, roles, permissions, is_active, account_completed
) 
VALUES (
  'hello@accessyourplace.com', 
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQkLgpNyU2QLqw4aOTq7NzpRjvIZGC', 
  'Admin User',
  'Admin',
  'User',
  'Operations', 
  'admin',
  'success_managers',
  ARRAY['success_managers'],
  ARRAY['all'],
  TRUE,
  TRUE
)
ON CONFLICT (email) DO UPDATE SET 
  password_hash = '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQkLgpNyU2QLqw4aOTq7NzpRjvIZGC',
  first_name = 'Admin',
  last_name = 'User',
  department = 'success_managers',
  roles = ARRAY['success_managers'],
  permissions = ARRAY['all'],
  account_completed = TRUE;

-- Add assigned_acquisition_manager_id to investors if not exists
ALTER TABLE investors ADD COLUMN IF NOT EXISTS assigned_acquisition_manager_id UUID REFERENCES staff_users(id);
CREATE INDEX IF NOT EXISTS idx_investors_am ON investors(assigned_acquisition_manager_id);
