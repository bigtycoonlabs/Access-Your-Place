# Comprehensive Test Workflows

## Complete Test Suite for Access Your Place Platform

This document provides comprehensive test scripts for:
1. **Investor Portfolio & Credit System**
2. **Complete Deal Upload Workflow**
3. **AM Assignment Workflow**

---

## Prerequisites

Before running tests:
1. Access to Staff Dashboard (`/staff`)
2. Access to Investor Portal (`/investor`)
3. Valid staff credentials
4. Valid investor credentials (or create test investor)
5. Test property data ready
6. Browser console access for API testing

---

# PART 1: Investor Portfolio & Credit System Testing

## Test 1.1: Log into Investor Portal

### Steps:
1. Navigate to `/investor`
2. Enter investor email and password
3. Click "Sign In"

### Expected Results:
- ✅ Successful login redirects to Investor Dashboard
- ✅ Investor name displayed in header
- ✅ Dashboard widgets load correctly
- ✅ No loading spinner stuck indefinitely

### API Test:
```javascript
// Test investor login
const { data, error } = await supabase.functions.invoke('investor-login', {
  body: { 
    email: 'test@investor.com', 
    password: 'testpassword123' 
  }
});
console.log('Login result:', data);
console.assert(data?.success, 'Login should succeed');
console.assert(data?.investor?.id, 'Should return investor ID');
```

### Troubleshooting Long Load Times:
```javascript
// Check if session is valid
const session = localStorage.getItem('investorSession');
if (session) {
  const parsed = JSON.parse(session);
  console.log('Session expires:', new Date(parsed.expires_at));
  if (new Date(parsed.expires_at) < new Date()) {
    console.log('Session expired - clearing');
    localStorage.removeItem('investorSession');
    window.location.reload();
  }
}
```

### Rollback:
```javascript
// Clear session and retry
localStorage.removeItem('investorSession');
localStorage.removeItem('investorSessionToken');
window.location.href = '/investor';
```

---

## Test 1.2: Add New Property to Portfolio

### Steps:
1. Navigate to "Portfolio" tab in investor portal
2. Click "Add Property" button
3. Fill in all required fields:
   - Address: "456 Portfolio Test St"
   - City: "Austin"
   - State: "TX"
   - ZIP: "78702"
   - Bedrooms: 4
   - Bathrooms: 3
   - Monthly Rent: $3,000
   - Monthly Earnings: $5,500
   - Initial Investment: $18,000
   - Property Type: "Single Family"
   - Operation Type: "STR"
   - Acquired Through AYP: Yes (to test verification flow)
   - Acquisition Manager: "John Smith"
4. Upload 3-5 photos
5. Click "Save Property"

### Expected Results:
- ✅ Property appears in portfolio list
- ✅ Status shows "Pending Approval" (if acquired through AYP)
- ✅ Photos display correctly
- ✅ Toast notification confirms creation
- ✅ Success team receives notification (Test 1.3)

### API Test:
```javascript
// Add portfolio property
const { data, error } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'add_portfolio_property',
    investor_id: 'YOUR_INVESTOR_ID',
    property_data: {
      address: '456 Portfolio Test St',
      city: 'Austin',
      state: 'TX',
      zip_code: '78702',
      bedrooms: 4,
      bathrooms: 3,
      monthly_rent: 3000,
      monthly_earnings: 5500,
      initial_investment: 18000,
      property_type: 'single_family',
      operation_type: 'str',
      acquired_through_ayp: true,
      acquisition_manager: 'John Smith',
      notes: 'Test property for verification'
    }
  }
});
console.log('Add property result:', data);
console.assert(data?.success, 'Property should be added');
console.assert(data?.property?.id, 'Should return property ID');
```

### Rollback:
```javascript
// Delete test property
await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'delete_portfolio_property',
    investor_id: 'YOUR_INVESTOR_ID',
    property_id: 'TEST_PROPERTY_ID'
  }
});
```

---

## Test 1.3: Verify Success Team Receives Notification

### Steps:
1. Log in as staff member with success_manager role
2. Navigate to Staff Dashboard
3. Check Notifications tab
4. Look for "Portfolio Property Added" notification

### Expected Results:
- ✅ Notification appears in staff notifications
- ✅ Notification contains investor name and property address
- ✅ Priority is "high" for AYP acquisitions
- ✅ Email notification sent to success managers

### API Verification:
```javascript
// Check staff notifications
const { data } = await supabase
  .from('staff_notifications')
  .select('*')
  .eq('notification_type', 'portfolio_property_added')
  .order('created_at', { ascending: false })
  .limit(5);
console.log('Recent notifications:', data);
console.assert(data.length > 0, 'Should have notification');
```

---

## Test 1.4: Credit System - Add Credits

### Steps:
1. As staff, navigate to Investor Management
2. Find test investor
3. Click "Manage Credits"
4. Add 500 credits with description "Test credit addition"
5. Confirm addition

### Expected Results:
- ✅ Credit balance increases by 500
- ✅ Transaction recorded in history
- ✅ Toast notification confirms addition

### API Test:
```javascript
// Add credits to investor
const { data } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'add_credits',
    investor_id: 'YOUR_INVESTOR_ID',
    amount: 500,
    description: 'Test credit addition',
    reference_type: 'manual_adjustment'
  }
});
console.log('Add credits result:', data);
console.assert(data?.success, 'Credits should be added');
console.assert(data?.new_balance >= 500, 'Balance should be at least 500');
```

---

## Test 1.5: Credit System - Use Credits

### Steps:
1. As investor, navigate to Credits tab
2. View current balance
3. Perform an action that uses credits (e.g., request deal analysis)
4. Verify credits deducted

### Expected Results:
- ✅ Credit balance decreases appropriately
- ✅ Transaction recorded with description
- ✅ Service/feature unlocked

### API Test:
```javascript
// Use credits
const { data } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'use_credits',
    investor_id: 'YOUR_INVESTOR_ID',
    amount: 50,
    description: 'Deal analysis request',
    reference_type: 'deal_analysis'
  }
});
console.log('Use credits result:', data);
console.assert(data?.success, 'Credits should be used');

// Test insufficient credits
const { data: failData } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'use_credits',
    investor_id: 'YOUR_INVESTOR_ID',
    amount: 999999,
    description: 'Should fail'
  }
});
console.assert(!failData?.success, 'Should fail with insufficient credits');
console.assert(failData?.error === 'Insufficient credits', 'Should return correct error');
```

---

## Test 1.6: List Property for Sale on Marketplace

### Steps:
1. Navigate to "Marketplace" tab in investor portal
2. Click "List Property for Sale"
3. Select property from portfolio
4. Choose "Public Listing"
5. Fill in listing details:
   - Asking Price: $25,000
   - Monthly Revenue: $5,500
   - Monthly Expenses: $3,000
   - Lease Months Remaining: 8
   - Is Furnished: Yes
   - ADR: $185
   - Occupancy Rate: 72%
6. Agree to landlord verification call
7. Submit listing

### Expected Results:
- ✅ Listing created with "pending_approval" status
- ✅ Confirmation email sent to investor
- ✅ Verification alert created for staff
- ✅ Success managers notified

### API Test:
```javascript
// Create marketplace listing
const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
  body: {
    action: 'create_listing',
    investor_id: 'YOUR_INVESTOR_ID',
    property_id: 'YOUR_PORTFOLIO_PROPERTY_ID',
    listing_type: 'public',
    acquisition_cost: 25000,
    projected_monthly_revenue: 5500,
    monthly_rent: 3000,
    lease_months_remaining: 8,
    is_furnished: true,
    landlord_verification_call_agreed: true,
    adr: 185,
    occupancy_rate: 72,
    operation_type: 'str',
    description: 'Well-established STR with consistent bookings'
  }
});
console.log('Create listing result:', data);
console.assert(data?.success, 'Listing should be created');
console.assert(data?.listing?.status === 'pending_approval', 'Status should be pending');
```

---

## Test 1.7: Verify Listing in Staff Verification Queue

### Steps:
1. Log in as staff member
2. Navigate to "Marketplace Verifications" tab
3. Find the test listing
4. Verify all details are correct

### Expected Results:
- ✅ Listing appears in verification queue
- ✅ All submitted details visible
- ✅ Approve/Reject/Request Changes buttons available

### API Test:
```javascript
// Get verification queue
const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
  body: {
    action: 'get_verification_queue',
    status: 'pending'
  }
});
console.log('Verification queue:', data);
const testListing = data?.alerts?.find(a => a.investor_id === 'YOUR_INVESTOR_ID');
console.assert(testListing, 'Test listing should be in queue');
```

---

# PART 2: Complete Deal Upload Workflow

## Test 2.1: Staff Login

### Steps:
1. Navigate to `/staff`
2. Enter staff email and password
3. Click "Sign In"

### Expected Results:
- ✅ Successful login redirects to Staff Dashboard
- ✅ Staff name displayed in header
- ✅ All dashboard tabs accessible

### API Test:
```javascript
const { data } = await supabase.functions.invoke('staff-login', {
  body: { 
    email: 'staff@accessyourplace.com', 
    password: 'staffpassword' 
  }
});
console.assert(data?.success, 'Staff login should succeed');
```

---

## Test 2.2: Create New Deal with Address '123 Test Ave, Austin, TX'

### Steps:
1. Navigate to "Deal Flow" tab
2. Click "Add Deal" button
3. Fill in all fields:
   - **Address**: 123 Test Ave
   - **City**: Austin
   - **State**: TX
   - **ZIP**: 78701
   - **Bedrooms**: 3
   - **Bathrooms**: 2
   - **Monthly Rent**: $2,800
   - **Property Type**: Single Family
   - **Operation Type**: STR
   - **Listing Title**: "Austin Downtown STR - Test Property"
   - **Description**: "Beautiful 3BR home in downtown Austin, perfect for short-term rentals. Walking distance to 6th Street and convention center."
   - **Landlord Name**: Test Landlord
   - **Landlord Phone**: 512-555-1234
   - **Landlord Email**: landlord@test.com
   - **Expected ADR**: $195
   - **Expected Occupancy**: 68%
4. Click "Save Deal"

### Expected Results:
- ✅ Deal appears in deal flow list
- ✅ Status shows "New"
- ✅ Workflow stage shows "New"
- ✅ Toast notification confirms creation

### API Test:
```javascript
// Create deal
const { data } = await supabase.functions.invoke('add-property', {
  body: {
    address: '123 Test Ave',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    bedrooms: 3,
    bathrooms: 2,
    monthly_rent: 2800,
    property_type: 'single_family',
    operation_type: 'str',
    listing_title: 'Austin Downtown STR - Test Property',
    description: 'Beautiful 3BR home in downtown Austin, perfect for short-term rentals.',
    landlord_name: 'Test Landlord',
    landlord_phone: '512-555-1234',
    landlord_email: 'landlord@test.com',
    expected_adr: 195,
    expected_occupancy: 68,
    workflow_stage: 'new',
    status: 'new'
  }
});
console.log('Create deal result:', data);
console.assert(data?.success, 'Deal should be created');
const propertyId = data?.property?.id;
console.log('Property ID:', propertyId);
```

---

## Test 2.3: Upload 3 Photos

### Steps:
1. Find the test deal in deal flow
2. Click "Manage Photos" or the photo icon
3. Upload 3 test images:
   - Front exterior
   - Living room
   - Kitchen
4. Click "Save Photos"

### Expected Results:
- ✅ Photos upload successfully
- ✅ Photo count updates on property card (shows "3")
- ✅ Photos visible in property detail modal

### API Test:
```javascript
// Upload photos (base64 encoded)
const { data } = await supabase.functions.invoke('process-property-photos', {
  body: {
    property_id: 'YOUR_PROPERTY_ID',
    photos: [
      { filename: 'front.jpg', data: 'BASE64_IMAGE_DATA', is_primary: true },
      { filename: 'living.jpg', data: 'BASE64_IMAGE_DATA' },
      { filename: 'kitchen.jpg', data: 'BASE64_IMAGE_DATA' }
    ]
  }
});
console.assert(data?.success, 'Photos should upload');
```

---

## Test 2.4: Move Deal Through Kanban Stages

### Steps:
1. Switch to Kanban view (click "Kanban" toggle)
2. Find deal in "New" column
3. Drag to "Researching" → Add note: "Starting market research"
4. Drag to "Landlord Contact" → Add note: "Reached out to landlord"
5. Drag to "Negotiating" → Add note: "Negotiating lease terms"
6. Drag to "Approved" → Add note: "Lease terms approved"
7. Drag to "Published" → Add note: "Ready for investors"

### Expected Results:
- ✅ Deal moves between columns smoothly
- ✅ Activity log entry created for each move
- ✅ Toast notification confirms each change
- ✅ Time in stage counter resets

### API Test (Stage Transition):
```javascript
// Update workflow stage
const { data } = await supabase.functions.invoke('update-property', {
  body: {
    id: 'YOUR_PROPERTY_ID',
    workflow_stage: 'researching',
    stage_notes: 'Starting market research',
    updated_by: 'staff_user_id'
  }
});
console.assert(data?.success, 'Stage should update');

// Verify activity log
const { data: logs } = await supabase
  .from('deal_activity_log')
  .select('*')
  .eq('property_id', 'YOUR_PROPERTY_ID')
  .eq('activity_type', 'stage_change')
  .order('created_at', { ascending: false });
console.log('Activity logs:', logs);
```

### Complete Stage Progression Test:
```javascript
const stages = ['researching', 'landlord_contact', 'negotiating', 'approved', 'published'];
const notes = [
  'Starting market research',
  'Reached out to landlord',
  'Negotiating lease terms',
  'Lease terms approved',
  'Ready for investors'
];

for (let i = 0; i < stages.length; i++) {
  const { data } = await supabase.functions.invoke('update-property', {
    body: {
      id: 'YOUR_PROPERTY_ID',
      workflow_stage: stages[i],
      stage_notes: notes[i],
      is_published: stages[i] === 'published'
    }
  });
  console.log(`Stage ${stages[i]}:`, data?.success ? '✅' : '❌');
  await new Promise(r => setTimeout(r, 500)); // Brief delay between stages
}
```

---

## Test 2.5: Verify Deal Appears on Public Deals Page

### Steps:
1. Navigate to `/deals` (public deals page)
2. Search for "Austin" or "123 Test Ave"
3. Verify the deal appears in results

### Expected Results:
- ✅ Deal appears in search results
- ✅ All entered data displays correctly
- ✅ Photos visible
- ✅ "Inquire" button available

### API Test:
```javascript
// Fetch published deals
const { data } = await supabase.functions.invoke('get-properties', {
  body: { 
    is_published: true,
    city: 'Austin'
  }
});
const testDeal = data?.properties?.find(p => p.address === '123 Test Ave');
console.assert(testDeal, 'Test deal should be published');
console.log('Published deal:', testDeal);
```

---

## Test 2.6: Test Penny AI Can Find and Describe the Deal

### Steps:
1. Open Penny AI chat (floating button)
2. Ask: "What deals are available in Austin?"
3. Verify Penny mentions the test property
4. Ask: "Tell me more about the property on Test Ave"

### Expected Results:
- ✅ Penny lists Austin deals including test property
- ✅ Penny provides property details (3BR/2BA, $2,800/mo)
- ✅ Penny provides Austin market data (ADR, occupancy, regulations)
- ✅ Penny mentions 2026 travel trends for Austin

### API Test:
```javascript
// Test Penny's deal access
const { data: dealsData } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_live_deals',
    city: 'Austin',
    limit: 10
  }
});
console.log('Penny sees deals:', dealsData?.deals?.length);
const testDeal = dealsData?.deals?.find(d => d.address === '123 Test Ave');
console.assert(testDeal, 'Penny should see test deal');

// Test Penny's chat response
const { data: chatData } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    message: 'What deals are available in Austin?',
    user_type: 'investor',
    user_name: 'Test User'
  }
});
console.log('Penny response:', chatData?.message);
console.assert(chatData?.deals_available > 0, 'Penny should report available deals');

// Test market data
const { data: marketData } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_market_data',
    market: 'Austin'
  }
});
console.log('Austin market data:', marketData?.market);
console.assert(marketData?.market?.adr, 'Should have ADR data');
console.assert(marketData?.market?.travelTrends2026, 'Should have 2026 trends');
```

---

# PART 3: AM Assignment Workflow Testing

## Test 3.1: Submit AM Assignment Request (Investor without AM)

### Steps:
1. Log in as investor without assigned AM
2. Navigate to "My AM" or "Acquisition Manager" section
3. Click "Request an Acquisition Manager"
4. Fill in preferences:
   - Preferred Markets: Austin, Nashville, Tampa
   - Preferred Operation Types: STR, Co-Living
   - Investment Budget Min: $15,000
   - Investment Budget Max: $50,000
5. Submit request

### Expected Results:
- ✅ Request created with "pending" status
- ✅ Confirmation message shown to investor
- ✅ Success team notified (email + SMS + in-app)

### API Test:
```javascript
// Submit AM assignment request
const { data } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'submit_am_assignment',
    investor_id: 'YOUR_INVESTOR_ID',
    investor_email: 'investor@test.com',
    investor_name: 'Test Investor',
    investor_phone: '555-123-4567',
    preferred_markets: ['Austin', 'Nashville', 'Tampa'],
    preferred_operation_types: ['str', 'coliving'],
    investment_budget_min: 15000,
    investment_budget_max: 50000
  }
});
console.log('AM request result:', data);
console.assert(data?.success, 'Request should be created');
console.assert(data?.request?.id, 'Should return request ID');
```

---

## Test 3.2: Verify Success Team Receives Notification

### Steps:
1. Log in as staff with success_manager role
2. Check notifications (bell icon or Notifications tab)
3. Look for "New AM Assignment Request" notification
4. Verify email was received

### Expected Results:
- ✅ In-app notification appears
- ✅ Email notification sent
- ✅ SMS notification sent (if phone configured)
- ✅ Notification contains investor details and preferences

### API Verification:
```javascript
// Check staff notifications
const { data } = await supabase
  .from('staff_notifications')
  .select('*')
  .eq('notification_type', 'am_assignment_request')
  .order('created_at', { ascending: false })
  .limit(5);
console.log('AM request notifications:', data);
```

---

## Test 3.3: View Pending AM Assignment Requests (Staff)

### Steps:
1. Navigate to Staff Dashboard
2. Go to "AM Assignments" or "Investor Management" tab
3. View pending AM assignment requests
4. Verify test request appears with all details

### Expected Results:
- ✅ Request appears in pending queue
- ✅ Investor details visible
- ✅ Preferred markets and budget shown
- ✅ Suggested AMs listed (based on market overlap)

### API Test:
```javascript
// Get pending AM assignment requests
const { data } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'get_am_assignment_requests',
    status: 'pending'
  }
});
console.log('Pending requests:', data?.requests);
const testRequest = data?.requests?.find(r => r.investor_email === 'investor@test.com');
console.assert(testRequest, 'Test request should be in queue');
console.assert(testRequest?.suggested_ams?.length >= 0, 'Should have AM suggestions');
```

---

## Test 3.4: Match AM to Investor

### Steps:
1. Find the test request in AM assignment queue
2. Review suggested AMs
3. Select an AM to assign
4. Add notes: "Matched based on Austin market expertise"
5. Click "Assign AM"

### Expected Results:
- ✅ Request status changes to "matched"
- ✅ Investor record updated with AM assignment
- ✅ Investor receives email notification
- ✅ AM receives email notification

### API Test:
```javascript
// Get list of AMs
const { data: staffData } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'get_staff_list',
    role: 'acquisition_manager'
  }
});
const amId = staffData?.staff?.[0]?.id;
console.log('Available AMs:', staffData?.staff);

// Match AM to investor
const { data } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'match_am_assignment',
    request_id: 'YOUR_REQUEST_ID',
    am_id: amId,
    notes: 'Matched based on Austin market expertise'
  }
});
console.log('Match result:', data);
console.assert(data?.success, 'Match should succeed');
console.assert(data?.am?.name, 'Should return AM name');
```

---

## Test 3.5: Verify Email Notifications

### Steps:
1. Check investor's email for "Your Acquisition Manager Has Been Assigned!"
2. Check AM's email for "New Investor Assigned to You"
3. Verify both emails contain correct information

### Expected Email Content:

**Investor Email:**
- Subject: "Your Acquisition Manager Has Been Assigned!"
- Contains AM name, email, phone
- Welcoming message

**AM Email:**
- Subject: "New Investor Assigned to You"
- Contains investor name, email, phone
- Contains preferred markets and budget
- Instructions to reach out within 24 hours

---

## Test 3.6: Test AM Change Request Flow

### Steps:
1. Log in as investor with assigned AM
2. Navigate to "My AM" section
3. Click "Request Different AM"
4. Enter reason: "Schedule conflicts - need AM available on weekends"
5. Submit request

### Expected Results:
- ✅ Change request created with "pending" status
- ✅ Success team notified
- ✅ Current AM not immediately changed

### API Test:
```javascript
// Request AM change
const { data } = await supabase.functions.invoke('investor-auth', {
  body: {
    action: 'request_am_change',
    investor_id: 'YOUR_INVESTOR_ID',
    investor_email: 'investor@test.com',
    investor_name: 'Test Investor',
    current_am_id: 'CURRENT_AM_ID',
    current_am_name: 'Current AM Name',
    reason: 'Schedule conflicts - need AM available on weekends'
  }
});
console.assert(data?.success, 'Change request should be created');
```

### Approve AM Change (Staff):
```javascript
// Get pending change requests
const { data: requests } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'get_am_change_requests',
    status: 'pending'
  }
});
console.log('Pending change requests:', requests?.requests);

// Approve change with new AM
const { data } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'approve_am_change',
    request_id: 'CHANGE_REQUEST_ID',
    new_am_id: 'NEW_AM_ID',
    admin_notes: 'Approved - assigned AM with weekend availability',
    processed_by: 'STAFF_ID'
  }
});
console.assert(data?.success, 'Change should be approved');
```

### Deny AM Change (Staff):
```javascript
const { data } = await supabase.functions.invoke('manage-staff', {
  body: {
    action: 'deny_am_change',
    request_id: 'CHANGE_REQUEST_ID',
    admin_notes: 'Current AM has adjusted schedule to accommodate',
    processed_by: 'STAFF_ID'
  }
});
console.assert(data?.success, 'Denial should be recorded');
```

---

# Automated Test Suite

## Complete Test Runner

```javascript
// COMPREHENSIVE AUTOMATED TEST SUITE
// Run in browser console or Node.js environment

async function runComprehensiveTests() {
  const results = [];
  const testData = {
    investorId: null,
    propertyId: null,
    portfolioPropertyId: null,
    listingId: null,
    amRequestId: null,
    staffId: null
  };

  console.log('🚀 Starting Comprehensive Test Suite...\n');

  // ========== PART 1: INVESTOR PORTFOLIO & CREDITS ==========
  console.log('📦 PART 1: Investor Portfolio & Credit System\n');

  // Test 1.1: Investor Login
  try {
    const { data } = await supabase.functions.invoke('investor-login', {
      body: { email: 'test@investor.com', password: 'testpass123' }
    });
    testData.investorId = data?.investor?.id;
    results.push({ 
      test: '1.1 Investor Login', 
      passed: data?.success && testData.investorId,
      details: testData.investorId ? `ID: ${testData.investorId}` : 'No ID returned'
    });
  } catch (e) {
    results.push({ test: '1.1 Investor Login', passed: false, error: e.message });
  }

  // Test 1.2: Add Portfolio Property
  if (testData.investorId) {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'add_portfolio_property',
          investor_id: testData.investorId,
          property_data: {
            address: '456 Test Portfolio St',
            city: 'Austin',
            state: 'TX',
            zip_code: '78702',
            bedrooms: 4,
            bathrooms: 3,
            monthly_rent: 3000,
            monthly_earnings: 5500,
            property_type: 'single_family',
            operation_type: 'str',
            acquired_through_ayp: true,
            acquisition_manager: 'Test AM'
          }
        }
      });
      testData.portfolioPropertyId = data?.property?.id;
      results.push({ 
        test: '1.2 Add Portfolio Property', 
        passed: data?.success,
        details: testData.portfolioPropertyId ? `Property ID: ${testData.portfolioPropertyId}` : ''
      });
    } catch (e) {
      results.push({ test: '1.2 Add Portfolio Property', passed: false, error: e.message });
    }
  }

  // Test 1.3: Get Portfolio Properties
  if (testData.investorId) {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'get_portfolio_properties',
          investor_id: testData.investorId
        }
      });
      results.push({ 
        test: '1.3 Get Portfolio Properties', 
        passed: data?.success && data?.properties?.length > 0,
        details: `Found ${data?.properties?.length || 0} properties`
      });
    } catch (e) {
      results.push({ test: '1.3 Get Portfolio Properties', passed: false, error: e.message });
    }
  }

  // Test 1.4: Add Credits
  if (testData.investorId) {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'add_credits',
          investor_id: testData.investorId,
          amount: 500,
          description: 'Test credit addition'
        }
      });
      results.push({ 
        test: '1.4 Add Credits', 
        passed: data?.success,
        details: `New balance: ${data?.new_balance}`
      });
    } catch (e) {
      results.push({ test: '1.4 Add Credits', passed: false, error: e.message });
    }
  }

  // Test 1.5: Use Credits
  if (testData.investorId) {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'use_credits',
          investor_id: testData.investorId,
          amount: 50,
          description: 'Test credit usage'
        }
      });
      results.push({ 
        test: '1.5 Use Credits', 
        passed: data?.success,
        details: `Remaining: ${data?.new_balance}`
      });
    } catch (e) {
      results.push({ test: '1.5 Use Credits', passed: false, error: e.message });
    }
  }

  // Test 1.6: Create Marketplace Listing
  if (testData.investorId && testData.portfolioPropertyId) {
    try {
      const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
        body: {
          action: 'create_listing',
          investor_id: testData.investorId,
          property_id: testData.portfolioPropertyId,
          listing_type: 'public',
          acquisition_cost: 25000,
          projected_monthly_revenue: 5500,
          monthly_rent: 3000,
          lease_months_remaining: 8,
          is_furnished: true,
          landlord_verification_call_agreed: true
        }
      });
      testData.listingId = data?.listing?.id;
      results.push({ 
        test: '1.6 Create Marketplace Listing', 
        passed: data?.success,
        details: `Listing ID: ${testData.listingId}, Status: ${data?.listing?.status}`
      });
    } catch (e) {
      results.push({ test: '1.6 Create Marketplace Listing', passed: false, error: e.message });
    }
  }

  // Test 1.7: Check Verification Queue
  try {
    const { data } = await supabase.functions.invoke('manage-deal-marketplace', {
      body: {
        action: 'get_verification_queue',
        status: 'pending'
      }
    });
    results.push({ 
      test: '1.7 Verification Queue', 
      passed: data?.success,
      details: `${data?.alerts?.length || 0} pending verifications`
    });
  } catch (e) {
    results.push({ test: '1.7 Verification Queue', passed: false, error: e.message });
  }

  // ========== PART 2: DEAL UPLOAD WORKFLOW ==========
  console.log('\n📝 PART 2: Deal Upload Workflow\n');

  // Test 2.1: Staff Login
  try {
    const { data } = await supabase.functions.invoke('staff-login', {
      body: { email: 'staff@test.com', password: 'staffpass123' }
    });
    testData.staffId = data?.staff?.id;
    results.push({ 
      test: '2.1 Staff Login', 
      passed: data?.success,
      details: testData.staffId ? `Staff ID: ${testData.staffId}` : ''
    });
  } catch (e) {
    results.push({ test: '2.1 Staff Login', passed: false, error: e.message });
  }

  // Test 2.2: Create Deal
  try {
    const { data } = await supabase.functions.invoke('add-property', {
      body: {
        address: '123 Test Ave',
        city: 'Austin',
        state: 'TX',
        zip_code: '78701',
        bedrooms: 3,
        bathrooms: 2,
        monthly_rent: 2800,
        property_type: 'single_family',
        operation_type: 'str',
        listing_title: 'Austin Downtown STR - Test Property',
        description: 'Test property for workflow verification',
        workflow_stage: 'new'
      }
    });
    testData.propertyId = data?.property?.id;
    results.push({ 
      test: '2.2 Create Deal (123 Test Ave)', 
      passed: data?.success && testData.propertyId,
      details: `Property ID: ${testData.propertyId}`
    });
  } catch (e) {
    results.push({ test: '2.2 Create Deal', passed: false, error: e.message });
  }

  // Test 2.3: Update Workflow Stages
  if (testData.propertyId) {
    const stages = ['researching', 'landlord_contact', 'negotiating', 'approved', 'published'];
    let allStagesPassed = true;
    
    for (const stage of stages) {
      try {
        const { data } = await supabase.functions.invoke('update-property', {
          body: {
            id: testData.propertyId,
            workflow_stage: stage,
            is_published: stage === 'published',
            stage_notes: `Moving to ${stage}`
          }
        });
        if (!data?.success) allStagesPassed = false;
      } catch (e) {
        allStagesPassed = false;
      }
    }
    
    results.push({ 
      test: '2.3 Workflow Stage Transitions', 
      passed: allStagesPassed,
      details: allStagesPassed ? 'All 5 stages completed' : 'Some stages failed'
    });
  }

  // Test 2.4: Verify Deal Published
  try {
    const { data } = await supabase.functions.invoke('get-properties', {
      body: { is_published: true, city: 'Austin' }
    });
    const testDeal = data?.properties?.find(p => p.address === '123 Test Ave');
    results.push({ 
      test: '2.4 Deal Published on Live Site', 
      passed: !!testDeal,
      details: testDeal ? 'Found on public deals page' : 'Not found'
    });
  } catch (e) {
    results.push({ test: '2.4 Deal Published', passed: false, error: e.message });
  }

  // Test 2.5: Penny AI Can Find Deal
  try {
    const { data } = await supabase.functions.invoke('ai-investor-chat', {
      body: {
        action: 'get_live_deals',
        city: 'Austin',
        limit: 10
      }
    });
    const pennySeesIt = data?.deals?.some(d => d.address === '123 Test Ave');
    results.push({ 
      test: '2.5 Penny AI Sees Deal', 
      passed: data?.success && pennySeesIt,
      details: `Penny sees ${data?.deals?.length || 0} Austin deals`
    });
  } catch (e) {
    results.push({ test: '2.5 Penny AI Sees Deal', passed: false, error: e.message });
  }

  // Test 2.6: Penny AI Market Data
  try {
    const { data } = await supabase.functions.invoke('ai-investor-chat', {
      body: {
        action: 'get_market_data',
        market: 'Austin'
      }
    });
    results.push({ 
      test: '2.6 Penny AI Market Data', 
      passed: data?.success && data?.market?.adr,
      details: `ADR: ${data?.market?.adr}, Outlook: ${data?.market?.marketOutlook}`
    });
  } catch (e) {
    results.push({ test: '2.6 Penny AI Market Data', passed: false, error: e.message });
  }

  // ========== PART 3: AM ASSIGNMENT WORKFLOW ==========
  console.log('\n👤 PART 3: AM Assignment Workflow\n');

  // Test 3.1: Submit AM Assignment Request
  if (testData.investorId) {
    try {
      const { data } = await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'submit_am_assignment',
          investor_id: testData.investorId,
          investor_email: 'test@investor.com',
          investor_name: 'Test Investor',
          preferred_markets: ['Austin', 'Nashville', 'Tampa'],
          preferred_operation_types: ['str', 'coliving'],
          investment_budget_min: 15000,
          investment_budget_max: 50000
        }
      });
      testData.amRequestId = data?.request?.id;
      results.push({ 
        test: '3.1 Submit AM Assignment Request', 
        passed: data?.success,
        details: `Request ID: ${testData.amRequestId}`
      });
    } catch (e) {
      results.push({ test: '3.1 Submit AM Assignment Request', passed: false, error: e.message });
    }
  }

  // Test 3.2: Get AM Assignment Requests
  try {
    const { data } = await supabase.functions.invoke('manage-staff', {
      body: {
        action: 'get_am_assignment_requests',
        status: 'pending'
      }
    });
    results.push({ 
      test: '3.2 Get AM Assignment Requests', 
      passed: data?.success && data?.requests?.length > 0,
      details: `${data?.requests?.length || 0} pending requests`
    });
  } catch (e) {
    results.push({ test: '3.2 Get AM Assignment Requests', passed: false, error: e.message });
  }

  // Test 3.3: Get Staff List (AMs)
  try {
    const { data } = await supabase.functions.invoke('manage-staff', {
      body: {
        action: 'get_staff_list',
        role: 'acquisition_manager'
      }
    });
    results.push({ 
      test: '3.3 Get AM Staff List', 
      passed: data?.success,
      details: `${data?.staff?.length || 0} AMs available`
    });
  } catch (e) {
    results.push({ test: '3.3 Get AM Staff List', passed: false, error: e.message });
  }

  // ========== CLEANUP ==========
  console.log('\n🧹 Cleanup\n');

  // Cleanup: Delete test property
  if (testData.propertyId) {
    try {
      await supabase.functions.invoke('delete-property', {
        body: { property_id: testData.propertyId }
      });
      console.log('✅ Deleted test property');
    } catch (e) {
      console.log('⚠️ Could not delete test property:', e.message);
    }
  }

  // Cleanup: Delete portfolio property
  if (testData.investorId && testData.portfolioPropertyId) {
    try {
      await supabase.functions.invoke('investor-auth', {
        body: {
          action: 'delete_portfolio_property',
          investor_id: testData.investorId,
          property_id: testData.portfolioPropertyId
        }
      });
      console.log('✅ Deleted test portfolio property');
    } catch (e) {
      console.log('⚠️ Could not delete portfolio property:', e.message);
    }
  }

  // ========== RESULTS ==========
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60) + '\n');

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.test}`);
    if (r.details) console.log(`   ${r.details}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log('\n' + '='.repeat(60));
  console.log(`📈 SUMMARY: ${passed}/${total} tests passed (${percentage}%)`);
  console.log('='.repeat(60));

  return { results, passed, total, percentage };
}

// Run the tests
runComprehensiveTests().then(summary => {
  if (summary.percentage < 100) {
    console.log('\n⚠️ Some tests failed. Review the results above.');
  } else {
    console.log('\n🎉 All tests passed!');
  }
});
```

---

# Error Handling & Rollback Procedures

## Common Issues and Solutions

### Issue: Investor Portal Loading Too Long
```javascript
// Solution 1: Clear stale session
localStorage.removeItem('investorSession');
localStorage.removeItem('investorSessionToken');
sessionStorage.clear();
window.location.reload();

// Solution 2: Check network requests
// Open DevTools > Network tab
// Look for failed requests to edge functions
// Check for CORS errors

// Solution 3: Verify edge function health
const { data } = await supabase.functions.invoke('investor-session', {
  body: { action: 'validate' }
});
console.log('Session health:', data);
```

### Issue: Credit System Not Working
```javascript
// Verify investor has credit fields
const { data } = await supabase
  .from('investors')
  .select('credit_balance, total_credits_earned, total_credits_spent')
  .eq('id', 'INVESTOR_ID')
  .single();
console.log('Credit fields:', data);

// If null, initialize credits
await supabase
  .from('investors')
  .update({
    credit_balance: 0,
    total_credits_earned: 0,
    total_credits_spent: 0
  })
  .eq('id', 'INVESTOR_ID');
```

### Issue: Marketplace Listing Not Appearing
```javascript
// Check listing status
const { data } = await supabase
  .from('deal_listings')
  .select('*')
  .eq('seller_id', 'INVESTOR_ID')
  .order('created_at', { ascending: false });
console.log('Listings:', data);

// Check verification alerts
const { data: alerts } = await supabase
  .from('marketplace_verification_alerts')
  .select('*')
  .eq('investor_id', 'INVESTOR_ID');
console.log('Verification alerts:', alerts);
```

### Issue: AM Assignment Not Working
```javascript
// Check if am_assignment_requests table exists
const { data, error } = await supabase
  .from('am_assignment_requests')
  .select('*')
  .limit(1);
  
if (error?.code === '42P01') {
  console.error('Table does not exist - run database migration');
}
```

---

# Success Criteria

All tests must pass for the workflows to be considered complete:

| Part | Test | Criteria |
|------|------|----------|
| 1 | Investor Login | Successful authentication, no long load |
| 1 | Add Portfolio Property | Property created, success team notified |
| 1 | Credit Add | Balance increases, transaction logged |
| 1 | Credit Use | Balance decreases, insufficient check works |
| 1 | Create Listing | Listing created, verification alert generated |
| 1 | Verification Queue | Listing appears in staff queue |
| 2 | Staff Login | Successful authentication |
| 2 | Create Deal | Deal created at 123 Test Ave, Austin |
| 2 | Upload Photos | 3 photos attached |
| 2 | Kanban Stages | All 6 stages work (New → Published) |
| 2 | Published Deal | Deal visible on /deals page |
| 2 | Penny AI Deals | Penny can find and describe deal |
| 2 | Penny AI Markets | Penny provides Austin market data |
| 3 | AM Request | Request created, success team notified |
| 3 | View Requests | Staff can see pending requests |
| 3 | Match AM | AM assigned, both parties notified |
| 3 | AM Change | Change request flow works |

---

# Contact

For issues with these test workflows:
- Check edge function logs in Supabase dashboard
- Review browser console for errors
- Contact development team with specific error messages
