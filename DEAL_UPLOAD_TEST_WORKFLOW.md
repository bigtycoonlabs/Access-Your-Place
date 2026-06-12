# Deal Upload Test Workflow

## Complete Test Script for Deal Upload Verification

This document provides a comprehensive test script to verify the complete deal upload workflow, including staff login, deal creation, photo uploads, publishing, investor assignment, and notification verification.

---

## Prerequisites

Before running tests:
1. Access to Staff Dashboard (`/staff`)
2. Valid staff credentials
3. At least one investor in the system
4. Test property data ready

---

## Test 1: Staff Login

### Steps:
1. Navigate to `/staff`
2. Enter staff email and password
3. Click "Sign In"

### Expected Results:
- ✅ Successful login redirects to Staff Dashboard
- ✅ Staff name displayed in header
- ✅ All dashboard tabs accessible

### Rollback:
```javascript
// If login fails, clear session and retry
localStorage.removeItem('staffSession');
localStorage.removeItem('staffSessionToken');
window.location.href = '/staff';
```

---

## Test 2: Upload New Deal with All Fields

### Steps:
1. Navigate to "Deal Flow" tab
2. Click "Add Deal" button
3. Fill in all required fields:
   - Address: "123 Test Street"
   - City: "Austin"
   - State: "TX"
   - ZIP: "78701"
   - Bedrooms: 3
   - Bathrooms: 2
   - Monthly Rent: $2,500
   - Property Type: "Single Family"
   - Operation Type: "STR"
   - Listing Title: "Test Property - Austin STR"
   - Description: "Beautiful 3BR home perfect for STR"
4. Click "Save Deal"

### Expected Results:
- ✅ Deal appears in deal flow list
- ✅ Status shows "New"
- ✅ Workflow stage shows "New"
- ✅ Toast notification confirms creation

### API Verification:
```javascript
// Verify deal was created
const { data } = await supabase.functions.invoke('get-properties', {
  body: { address: '123 Test Street' }
});
console.assert(data.properties.length > 0, 'Deal should exist');
```

### Rollback:
```javascript
// Delete test deal if needed
await supabase.functions.invoke('delete-property', {
  body: { property_id: 'TEST_PROPERTY_ID' }
});
```

---

## Test 3: Upload Photos to Deal

### Steps:
1. Find the test deal in deal flow
2. Click "Manage Photos" button
3. Upload 3-5 test images
4. Click "Save Photos"

### Expected Results:
- ✅ Photos upload successfully
- ✅ Photo count updates on property card
- ✅ Photos visible in property detail modal

### API Verification:
```javascript
// Verify photos were saved
const { data } = await supabase
  .from('property_photos')
  .select('*')
  .eq('property_id', 'TEST_PROPERTY_ID');
console.assert(data.length >= 3, 'Should have at least 3 photos');
```

---

## Test 4: Verify Deal Appears in Deal Flow List

### Steps:
1. Navigate to Deal Flow tab
2. Use search to find "123 Test Street"
3. Verify all fields are correct

### Expected Results:
- ✅ Deal appears in search results
- ✅ All entered data is correct
- ✅ Photos thumbnail visible
- ✅ Status badge shows correctly

### Grid View Test:
1. Click "Grid View" toggle
2. Verify deal card displays correctly

### Kanban View Test:
1. Click "Kanban View" toggle
2. Verify deal appears in "New" column
3. Drag deal to "Researching" column
4. Verify stage change is logged

---

## Test 5: Workflow Stage Transitions

### Steps:
1. Switch to Kanban view
2. Drag deal from "New" to "Researching"
3. Add transition note: "Starting market research"
4. Click "Confirm Move"

### Expected Results:
- ✅ Deal moves to new column
- ✅ Activity log entry created
- ✅ Toast notification confirms change
- ✅ Time in stage counter resets

### Verify Activity Log:
```javascript
const { data } = await supabase
  .from('deal_activity_log')
  .select('*')
  .eq('property_id', 'TEST_PROPERTY_ID')
  .eq('activity_type', 'stage_change');
console.assert(data.length > 0, 'Activity log should have stage change');
```

---

## Test 6: Publish Deal to Live Site

### Steps:
1. Move deal to "Approved" stage
2. Click "Edit/Publish" on the deal
3. Review all information
4. Click "Publish to Marketplace"

### Expected Results:
- ✅ Deal status changes to "Published"
- ✅ Workflow stage changes to "Published"
- ✅ Deal appears on public Deals page (`/deals`)
- ✅ Activity log records publishing

### Verify on Live Site:
```javascript
// Check deal is published
const { data } = await supabase.functions.invoke('get-properties', {
  body: { is_published: true }
});
const published = data.properties.find(p => p.address === '123 Test Street');
console.assert(published, 'Deal should be published');
```

---

## Test 7: Assign Deal to Investor

### Steps:
1. Open deal detail modal
2. Click "Assign to Investor"
3. Search for test investor
4. Select investor from list
5. Click "Assign"

### Expected Results:
- ✅ Assignment confirmation toast
- ✅ Investor name shows on deal card
- ✅ Notification sent to investor

### Verify Assignment:
```javascript
const { data } = await supabase
  .from('property_assignments')
  .select('*')
  .eq('property_id', 'TEST_PROPERTY_ID');
console.assert(data.length > 0, 'Assignment should exist');
```

---

## Test 8: Verify Investor Receives Notification

### Steps:
1. Log in as the assigned investor
2. Check Notifications tab
3. Verify deal assignment notification

### Expected Results:
- ✅ Notification appears in investor portal
- ✅ Notification contains deal details
- ✅ Email notification sent (check email)

### Verify Notification:
```javascript
const { data } = await supabase
  .from('investor_notifications')
  .select('*')
  .eq('investor_id', 'TEST_INVESTOR_ID')
  .eq('type', 'deal_assigned');
console.assert(data.length > 0, 'Notification should exist');
```

---

## Test 9: Penny AI Can Read Live Deals

### Steps:
1. Open Penny AI chat (floating button)
2. Ask: "What deals are available in Austin?"
3. Verify Penny references the test deal

### Expected Results:
- ✅ Penny mentions Austin deals
- ✅ Test property details included
- ✅ Market data for Austin provided

### API Test:
```javascript
const { data } = await supabase.functions.invoke('ai-investor-chat', {
  body: {
    action: 'get_live_deals',
    city: 'Austin',
    limit: 10
  }
});
console.assert(data.deals.length > 0, 'Should return Austin deals');
```

---

## Test 10: Penny AI Market Insights

### Steps:
1. Ask Penny: "What's the market outlook for Austin?"
2. Verify response includes:
   - ADR range
   - Occupancy rates
   - Regulations
   - 2026 travel trends
   - Seasonality

### Expected Results:
- ✅ Specific market data provided
- ✅ Regulation information included
- ✅ Travel trends for 2026 mentioned
- ✅ Actionable advice given

---

## Automated Test Script

```javascript
// Complete automated test script
async function runDealUploadTests() {
  const results = [];
  
  // Test 1: Staff Login
  try {
    const { data: loginData } = await supabase.functions.invoke('staff-login', {
      body: { email: 'test@staff.com', password: 'testpass' }
    });
    results.push({ test: 'Staff Login', passed: loginData?.success });
  } catch (e) {
    results.push({ test: 'Staff Login', passed: false, error: e.message });
  }

  // Test 2: Create Deal
  try {
    const { data: dealData } = await supabase.functions.invoke('add-property', {
      body: {
        address: '123 Test Street',
        city: 'Austin',
        state: 'TX',
        zip_code: '78701',
        bedrooms: 3,
        bathrooms: 2,
        monthly_rent: 2500,
        property_type: 'single_family',
        operation_type: 'str',
        listing_title: 'Test Property - Austin STR',
        workflow_stage: 'new'
      }
    });
    results.push({ test: 'Create Deal', passed: dealData?.success, id: dealData?.property?.id });
  } catch (e) {
    results.push({ test: 'Create Deal', passed: false, error: e.message });
  }

  // Test 3: Verify in Deal Flow
  try {
    const { data } = await supabase.functions.invoke('get-properties', {
      body: { address: '123 Test Street' }
    });
    results.push({ test: 'Deal in Flow', passed: data?.properties?.length > 0 });
  } catch (e) {
    results.push({ test: 'Deal in Flow', passed: false, error: e.message });
  }

  // Test 4: Publish Deal
  const propertyId = results.find(r => r.id)?.id;
  if (propertyId) {
    try {
      await supabase.functions.invoke('update-property', {
        body: { id: propertyId, is_published: true, workflow_stage: 'published' }
      });
      results.push({ test: 'Publish Deal', passed: true });
    } catch (e) {
      results.push({ test: 'Publish Deal', passed: false, error: e.message });
    }
  }

  // Test 5: Penny AI Access
  try {
    const { data } = await supabase.functions.invoke('ai-investor-chat', {
      body: { action: 'get_live_deals', city: 'Austin' }
    });
    results.push({ test: 'Penny AI Deals', passed: data?.deals?.length > 0 });
  } catch (e) {
    results.push({ test: 'Penny AI Deals', passed: false, error: e.message });
  }

  // Test 6: Market Data
  try {
    const { data } = await supabase.functions.invoke('ai-investor-chat', {
      body: { action: 'get_market_data', market: 'Austin' }
    });
    results.push({ test: 'Market Data', passed: data?.market?.adr !== undefined });
  } catch (e) {
    results.push({ test: 'Market Data', passed: false, error: e.message });
  }

  // Cleanup
  if (propertyId) {
    await supabase.functions.invoke('delete-property', {
      body: { property_id: propertyId }
    });
  }

  // Report
  console.log('\n=== TEST RESULTS ===');
  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.test}${r.error ? `: ${r.error}` : ''}`);
  });
  
  const passed = results.filter(r => r.passed).length;
  console.log(`\nTotal: ${passed}/${results.length} tests passed`);
  
  return results;
}

// Run tests
runDealUploadTests();
```

---

## Error Handling & Rollback Procedures

### If Deal Creation Fails:
```javascript
// Check for validation errors
const errors = validateDealData(dealData);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  // Fix data and retry
}
```

### If Photo Upload Fails:
```javascript
// Retry with smaller batch
const photos = splitIntoBatches(allPhotos, 3);
for (const batch of photos) {
  await uploadPhotoBatch(batch);
}
```

### If Publishing Fails:
```javascript
// Check required fields
const requiredFields = ['address', 'city', 'state', 'bedrooms', 'bathrooms', 'monthly_rent'];
const missing = requiredFields.filter(f => !property[f]);
if (missing.length > 0) {
  console.error('Missing required fields:', missing);
}
```

### If Notification Fails:
```javascript
// Manually trigger notification
await supabase.functions.invoke('send-inquiry-notifications', {
  body: {
    investor_id: investorId,
    notification_type: 'deal_assigned',
    deal_data: dealData
  }
});
```

---

## Success Criteria

All tests must pass for the workflow to be considered complete:

| Test | Criteria |
|------|----------|
| Staff Login | Successful authentication |
| Deal Creation | All fields saved correctly |
| Photo Upload | 3+ photos attached |
| Deal Flow Display | Deal visible in list/kanban |
| Workflow Stages | Stage transitions work |
| Publishing | Deal appears on live site |
| Investor Assignment | Assignment recorded |
| Notifications | Investor notified |
| Penny AI Deals | AI can access deals |
| Penny AI Markets | AI provides market data |

---

## Contact

For issues with this test workflow, contact the development team or file an issue in the project repository.
