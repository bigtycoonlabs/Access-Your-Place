# AM Assignment Matching Test Workflow

## Overview
This document provides a step-by-step test workflow to verify the Acquisition Manager (AM) assignment matching process works correctly.

---

## Test Scenario 1: New Investor Adds AM (Simplified Flow)

### Step 1: Log in as Test Investor (No AM Assigned)

1. Navigate to `/investor/login`
2. Log in with test investor credentials
3. Navigate to the Dashboard tab
4. Verify the "Add Your Acquisition Manager" card is displayed
5. The card should show:
   - Benefits of adding an AM
   - "Add Your Acquisition Manager" button
   - Link to book a discovery call if no AM yet

### Step 2: Submit AM Assignment Request

1. Click "Add Your Acquisition Manager" button
2. A dialog opens with:
   - First Name field (required)
   - Last Name field (required)
   - Additional Notes field (optional)
3. Enter the AM's first and last name (e.g., "John Smith")
4. Optionally add notes like "Met at the Austin investor meetup"
5. Click "Submit Request"
6. Verify success toast: "Request Submitted! Our Success Team will match you with your acquisition manager shortly."
7. The card should now show "AM Assignment Pending" status with:
   - The name you entered
   - "Pending Verification" badge
   - Submission date

### Step 3: Verify Staff Notification (Success Manager Dashboard)

1. Log out of investor portal
2. Navigate to `/staff/login`
3. Log in as a Success Manager
4. Navigate to "AM Verify" tab
5. The "AM Assignment Requests" section should show:
   - New request from the test investor
   - Investor's name and email
   - Requested AM name (John Smith)
   - "Match Found" or "No Auto-Match" badge
   - Date submitted

### Step 4: Match the AM Request

**If Auto-Match Found:**
1. Click "Quick Match" button
2. Verify the suggested AM is correct
3. Optionally add internal notes
4. Click "Match & Notify Both"

**If No Auto-Match:**
1. Click "Select AM" button
2. Choose the correct AM from the dropdown
3. Add internal notes if needed
4. Click "Match & Notify Both"

5. Verify success toast: "AM Matched Successfully!"
6. The request should disappear from the pending list

### Step 5: Verify Investor Confirmation

1. Log back into the investor portal
2. Navigate to Dashboard
3. The "Your Acquisition Manager" card should now show:
   - AM's name
   - "Verified" badge
   - AM's email (clickable)
   - AM's phone (if available)
   - "Send Message" button
   - "Schedule Call" button
   - "Request Different AM" option
4. Check investor's email for confirmation notification

---

## Test Scenario 2: Investor Requests Different AM

### Step 1: Log in as Investor with Assigned AM

1. Navigate to `/investor/login`
2. Log in with investor credentials (one who has an AM assigned)
3. Navigate to Dashboard
4. Verify the "Your Acquisition Manager" card shows current AM

### Step 2: Submit Change Request

1. Click "Request Different AM" button
2. A dialog opens with:
   - Reason for request (required)
   - Preferred AM Name (optional)
3. Enter reason: "I'd like to work with someone who specializes in multi-family properties"
4. Optionally enter preferred AM name
5. Click "Submit Request"
6. Verify success toast: "Request Submitted. Our Success Team will review your request within 24-48 hours."

### Step 3: Staff Reviews Change Request

1. Log in as Success Manager
2. Navigate to "AM Verify" tab
3. Click "Change Requests" sub-tab
4. Find the change request showing:
   - Investor name
   - Current AM name
   - Reason for change
   - Preferred AM (if specified)

### Step 4: Approve or Decline

**To Approve:**
1. Click "Assign New AM"
2. Select new AM from dropdown
3. Add response notes if needed
4. Click "Approve & Notify All"
5. Verify all parties are notified (investor, old AM, new AM)

**To Decline:**
1. Click "Decline"
2. Investor receives notification that request was reviewed

---

## Test Scenario 3: Staff Uploads Deal to Deal Flow

### Step 1: Access Deal Flow

1. Log in as staff member (any department with deal access)
2. Navigate to "Deal Flow" tab
3. Click "Add Deal" button

### Step 2: Enter Deal Information

1. Fill in property details:
   - Address (required)
   - City, State, ZIP
   - Property type
   - Bedrooms/Bathrooms
   - Square footage
   - Asking price
   - ARV (After Repair Value)
   - Monthly rent potential
2. Add property description
3. Upload photos (optional)
4. Set deal stage (Lead, Qualified, Under Contract, etc.)
5. Assign to specific investor (optional)

### Step 3: Save and Verify

1. Click "Save Deal"
2. Verify deal appears in the deal flow list
3. Check that all entered information is correct
4. Verify deal can be edited, moved between stages, and assigned

---

## Database Tables Required

### am_assignment_requests
```sql
CREATE TABLE am_assignment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID REFERENCES investors(id),
  investor_name TEXT NOT NULL,
  investor_email TEXT NOT NULL,
  investor_phone TEXT,
  am_first_name TEXT NOT NULL,
  am_last_name TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending', -- pending, matched, rejected
  matched_staff_id UUID REFERENCES staff_users(id),
  matched_at TIMESTAMP WITH TIME ZONE,
  matched_by UUID REFERENCES staff_users(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_am_assignment_requests_status ON am_assignment_requests(status);
CREATE INDEX idx_am_assignment_requests_investor ON am_assignment_requests(investor_id);
```

### am_change_requests
```sql
CREATE TABLE am_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID REFERENCES investors(id),
  investor_name TEXT NOT NULL,
  investor_email TEXT NOT NULL,
  current_am_id UUID REFERENCES staff_users(id),
  current_am_name TEXT,
  reason TEXT NOT NULL,
  preferred_am_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  new_am_id UUID REFERENCES staff_users(id),
  approved_by UUID REFERENCES staff_users(id),
  response_notes TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_am_change_requests_status ON am_change_requests(status);
CREATE INDEX idx_am_change_requests_investor ON am_change_requests(investor_id);
```

---

## Edge Function Actions Required

### investor-auth function
- `get_am_info` - Get current AM info and pending requests for investor
- `submit_am_assignment` - Submit new AM assignment request
- `request_am_change` - Submit request to change AM

### manage-staff function
- `get_am_assignment_requests` - Get all pending AM assignment requests
- `get_am_change_requests` - Get all pending AM change requests
- `match_am_assignment` - Match an AM assignment request to a staff member
- `reject_am_assignment` - Reject an AM assignment request
- `approve_am_change` - Approve an AM change request
- `reject_am_change` - Reject an AM change request
- `get_acquisition_managers_with_counts` - Get list of AMs with investor counts

---

## Email Notifications

### On AM Assignment Request Submitted
- **To Success Team**: "New AM Assignment Request from [Investor Name]"
- Contains: Investor details, requested AM name, notes

### On AM Assignment Matched
- **To Investor**: "Your Acquisition Manager Has Been Confirmed"
- **To AM**: "New Investor Assigned: [Investor Name]"
- Contains: Contact details, next steps

### On AM Change Request Submitted
- **To Success Team**: "AM Change Request from [Investor Name]"
- Contains: Current AM, reason, preferred AM

### On AM Change Approved
- **To Investor**: "Your Acquisition Manager Has Been Changed"
- **To Old AM**: "Investor [Name] Has Been Reassigned"
- **To New AM**: "New Investor Assigned: [Investor Name]"

### On AM Change Declined
- **To Investor**: "AM Change Request Update"
- Contains: Explanation, contact info for support

---

## Accessibility Checklist

### Investor Portal Forms
- [ ] All form fields have associated labels
- [ ] Required fields are marked with aria-required="true"
- [ ] Error messages are announced to screen readers
- [ ] Focus management on dialog open/close
- [ ] Keyboard navigation works for all interactive elements

### Staff Dashboard
- [ ] Tab navigation is keyboard accessible
- [ ] Data tables have proper headers
- [ ] Action buttons have descriptive labels
- [ ] Loading states are announced
- [ ] Success/error toasts are announced

---

## Known Issues & Fixes

### Issue 1: Duplicate AM Verification Import
- **Status**: Fixed
- **Description**: StaffDashboard.tsx had duplicate import of AMVerificationRequests
- **Fix**: Removed duplicate import line

### Issue 2: AM Assignment Requests Not Showing
- **Status**: Requires Backend
- **Description**: Need to implement edge function actions for AM assignment flow
- **Fix**: Add actions to manage-staff edge function

### Issue 3: Email Notifications Not Sending
- **Status**: Requires Backend
- **Description**: Need to implement email templates for AM assignment notifications
- **Fix**: Add email templates and integrate with send-email function

---

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Investor adds AM | Pending | Frontend complete, backend needed |
| Staff sees notification | Pending | Frontend complete, backend needed |
| Staff matches AM | Pending | Frontend complete, backend needed |
| Investor sees confirmation | Pending | Frontend complete, backend needed |
| AM change request | Pending | Frontend complete, backend needed |
| Deal flow upload | Verified | Working correctly |

---

## Next Steps

1. Deploy edge function updates for AM assignment flow
2. Create database tables for AM requests
3. Add email templates for notifications
4. End-to-end testing with real data
5. User acceptance testing with staff
