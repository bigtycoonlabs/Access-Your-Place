# Deal Upload, AM Assignment & Messaging Test Guide

## Overview
This document provides testing workflows for the staff deal upload, investor AM assignment, and messaging systems.

---

## 1. Staff Deal Upload Testing

### Test the Add Property Function
The `add-property` edge function is working correctly. Staff can upload deals to the deal flow.

**Test via Staff Dashboard:**
1. Log in to `/staff` with staff credentials
2. Navigate to "Deal Flow" tab
3. Click "Add Deal" button
4. Fill in property details:
   - Address, City, State, ZIP
   - Price, Bedrooms, Bathrooms
   - Property type, Operation type
   - Monthly rent, Cap rate
   - Photos (optional)
   - Landlord info (optional)
5. Click "Save Deal"
6. Verify deal appears in the deal flow list

**API Test:**
```javascript
// Test add-property function
const { data } = await supabase.functions.invoke('add-property', {
  body: {
    address: '123 Test St',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    price: 250000,
    bedrooms: 3,
    bathrooms: 2,
    property_type: 'single_family',
    operation_type: 'str',
    monthly_rent: 3500
  }
});
```

---

## 2. Simplified AM Assignment Testing

### Investor Flow (Easy Assignment)
1. Log in as an investor without an AM assigned
2. Go to Dashboard - see "Add Your Acquisition Manager" card
3. Click "Add Your Acquisition Manager"
4. Enter AM's first and last name (e.g., "John Smith")
5. Optionally add notes
6. Click "Submit Request"
7. See "AM Assignment Pending" status

### Staff Flow (Matching)
1. Log in to Staff Dashboard
2. Navigate to "AM Verify" tab
3. See "AM Assignment Requests" section
4. View pending requests with auto-matching suggestions
5. Click "Quick Match" if a suggested match is found
6. Or manually select a staff member to match
7. Click "Confirm Match"
8. Investor receives notification and email

### Request Different AM Flow
1. Log in as investor with AM assigned
2. Go to Dashboard - see AM card
3. Click "Request Different AM"
4. Enter reason for change
5. Optionally specify preferred AM name
6. Submit request
7. Staff receives notification to process

---

## 3. Messaging Testing

### Investor-to-Staff Messaging
1. Log in as investor
2. Navigate to Messages section
3. Compose new message
4. Send to AM or support team
5. Verify:
   - Message appears in conversation
   - Staff receives notification
   - Staff receives email notification

### Staff-to-Investor Messaging
1. Log in as staff
2. Navigate to "Messaging" tab
3. Select "Investor Messages" tab
4. Select an investor conversation
5. Compose and send message
6. Verify:
   - Message appears in thread
   - Investor receives notification
   - Investor receives email

### Staff-to-Staff Messaging
1. Log in as staff
2. Navigate to "Messaging" tab
3. Select "Staff Messages" tab
4. Click "New" to start conversation
5. Select recipient staff member
6. Compose and send message
7. Verify:
   - Message appears in thread
   - Recipient receives notification
   - Recipient receives email

---

## 4. Marketplace Verification Testing

### Public Listing Flow
1. Investor creates public listing
2. Success managers receive SMS + email notification
3. Listing appears in "Verification Queue" with normal priority
4. Staff reviews and approves/rejects/requests changes
5. Investor receives confirmation email

### Private Sale Verification Flow
1. Buyer requests verification on private deal
2. Success managers receive HIGH PRIORITY SMS + email
3. Alert appears in queue with red "HIGH PRIORITY" badge
4. Staff completes verification checklist
5. Both buyer and seller receive notifications

---

## 5. Database Tables Created

### am_assignment_requests
- Stores simplified AM assignment requests from investors
- Fields: investor_id, investor_email, investor_name, am_first_name, am_last_name, status, matched_staff_id, notes

### am_change_requests
- Stores requests from investors wanting a different AM
- Fields: investor_id, current_am_id, current_am_name, reason, preferred_am_name, status, new_am_id

### marketplace_verification_alerts
- Stores verification queue items for marketplace listings
- Fields: listing_id, investor_id, property_address, listing_type, priority, status, verification_notes

### staff_messages
- Stores staff-to-staff messages
- Fields: from_staff_id, to_staff_id, subject, message, is_read, read_at

---

## 6. Edge Functions Updated

### manage-staff v2.0
New actions:
- `get_am_assignment_requests` - Fetch pending AM requests with auto-match suggestions
- `match_am_assignment` - Assign AM to investor with email notifications
- `mark_am_not_found` - Mark request as not found
- `get_am_change_requests` - Fetch AM change requests
- `approve_am_change` - Approve and process AM change
- `deny_am_change` - Deny AM change request

### manage-deal-marketplace v2.3
New actions:
- `get_verification_queue` - Fetch pending verifications with filters
- `update_verification_alert` - Update alert status
- `request_listing_changes` - Request changes from investor

Enhanced:
- Public listings now send SMS + email to all success managers
- Private sale verifications create HIGH PRIORITY alerts
- Approval/rejection sends confirmation emails to investors

### investor-auth v3.4
Enhanced:
- `submit_am_assignment` - Creates record in am_assignment_requests table
- `request_am_change` - Creates record in am_change_requests table
- `get_am_info` - Checks both tables for pending requests

### investor-messaging
New actions:
- `send_staff_message` - Staff-to-staff messaging with email notifications
- `get_staff_messages` - Get staff conversations
- `mark_staff_message_read` - Mark message as read
- `get_staff_for_messaging` - Get list of staff for recipient dropdown

---

## 7. Email Notifications

All messaging flows now send email notifications:
- Investor → Staff: Email sent to assigned AM
- Staff → Investor: Email sent to investor
- Staff → Staff: Email sent to recipient staff member
- Marketplace listings: Email + SMS to success managers
- AM assignments: Email to both investor and AM

---

## 8. Ready for Tomorrow

The system is ready for onboarding deals:
1. ✅ Staff can upload deals via AddDealModal
2. ✅ Deal flow management is working
3. ✅ Investors can easily add their AM
4. ✅ Staff can match AM assignments
5. ✅ Messaging works in all directions
6. ✅ Email notifications are sent
7. ✅ Marketplace verification queue is functional
