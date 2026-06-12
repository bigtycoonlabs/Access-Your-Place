# Automated Test Suite for Investor Portal & Deal Workflow

## Overview
This document provides automated test scripts that can be run in the browser console to test the investor portal, deal workflow, and AM assignment features.

---

## Part 1: Investor Portal Tests

### Test 1.1: Create Test Investor Account
```javascript
// Run in browser console on the investor login page
async function testCreateInvestor() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  console.log('Creating test investor:', testEmail);
  
  const { data, error } = await window.supabase.functions.invoke('investor-register', {
    body: {
      email: testEmail,
      password: testPassword,
      full_name: 'Test Investor',
      phone: '555-123-4567'
    }
  });
  
  if (error) {
    console.error('Registration failed:', error);
    return null;
  }
  
  console.log('Registration result:', data);
  return { email: testEmail, password: testPassword, ...data };
}

// Execute
const testInvestor = await testCreateInvestor();
```

### Test 1.2: Login and Validate Session
```javascript
async function testLogin(email, password) {
  console.log('Logging in as:', email);
  
  const { data, error } = await window.supabase.functions.invoke('investor-login', {
    body: {
      action: 'login',
      email: email,
      password: password
    }
  });
  
  if (error || !data?.success) {
    console.error('Login failed:', error || data?.error);
    return null;
  }
  
  console.log('Login successful, session token:', data.session?.token?.substring(0, 20) + '...');
  
  // Store session
  localStorage.setItem('investorSession', JSON.stringify({
    ...data.investor,
    loginTime: Date.now()
  }));
  localStorage.setItem('investorSessionToken', data.session.token);
  
  return data;
}

// Execute with test credentials
const loginResult = await testLogin('test@example.com', 'TestPassword123!');
```

### Test 1.3: Validate Session with Caching
```javascript
async function testSessionValidation() {
  const sessionToken = localStorage.getItem('investorSessionToken');
  
  console.log('Testing session validation...');
  const start1 = Date.now();
  
  // First call (should hit database)
  const { data: result1 } = await window.supabase.functions.invoke('investor-session', {
    body: {
      action: 'validate_session',
      session_token: sessionToken
    }
  });
  
  console.log('First call (no cache):', Date.now() - start1, 'ms', result1?.success);
  
  // Second call (should hit cache)
  const start2 = Date.now();
  const { data: result2 } = await window.supabase.functions.invoke('investor-session', {
    body: {
      action: 'validate_session',
      session_token: sessionToken
    }
  });
  
  console.log('Second call (cached):', Date.now() - start2, 'ms', result2?.success);
  
  return { result1, result2 };
}

await testSessionValidation();
```

### Test 1.4: Add Portfolio Property
```javascript
async function testAddPortfolioProperty(investorId) {
  console.log('Adding portfolio property...');
  
  const propertyData = {
    address: '123 Test Ave',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    bedrooms: 3,
    bathrooms: 2,
    monthly_rent: 2500,
    initial_investment: 15000,
    monthly_earnings: 1200,
    property_type: 'single_family',
    acquired_through_ayp: true,
    acquisition_manager: 'sarah_johnson',
    acquisition_date: '2026-01-15',
    photo_urls: []
  };
  
  const { data, error } = await window.supabase.functions.invoke('investor-auth', {
    body: {
      action: 'add_portfolio_property',
      investor_id: investorId,
      property_data: propertyData
    }
  });
  
  if (error || !data?.success) {
    console.error('Add property failed:', error || data?.error);
    return null;
  }
  
  console.log('Property added:', data);
  return data;
}

// Execute (replace with actual investor ID)
const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testAddPortfolioProperty(stored.id);
```

### Test 1.5: Test Credit System
```javascript
async function testCreditSystem(investorId) {
  console.log('Testing credit system...');
  
  // Add credits
  const { data: addResult } = await window.supabase.functions.invoke('investor-auth', {
    body: {
      action: 'add_credits',
      investor_id: investorId,
      amount: 100,
      description: 'Test credit addition'
    }
  });
  
  console.log('Add credits result:', addResult);
  
  // Get balance
  const { data: balanceResult } = await window.supabase.functions.invoke('investor-auth', {
    body: {
      action: 'get_credit_balance',
      investor_id: investorId
    }
  });
  
  console.log('Credit balance:', balanceResult);
  
  // Use credits
  const { data: useResult } = await window.supabase.functions.invoke('investor-auth', {
    body: {
      action: 'use_credits',
      investor_id: investorId,
      amount: 25,
      description: 'Test credit usage'
    }
  });
  
  console.log('Use credits result:', useResult);
  
  return { addResult, balanceResult, useResult };
}

const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testCreditSystem(stored.id);
```

---

## Part 2: Penny AI Tests

### Test 2.1: Test Penny AI Market Data
```javascript
async function testPennyMarketData() {
  console.log('Testing Penny AI market data...');
  
  const { data } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      action: 'get_market_data',
      market: 'austin'
    }
  });
  
  console.log('Austin market data:', data);
  return data;
}

await testPennyMarketData();
```

### Test 2.2: Test Penny AI Preference Memory
```javascript
async function testPennyPreferenceMemory(investorId) {
  console.log('Testing Penny AI preference memory...');
  
  // First message - mention experience level and budget
  const { data: msg1 } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      message: "I'm a beginner investor looking to invest $15,000-25,000 in STR properties in Austin or Tampa",
      user_id: investorId,
      user_name: 'Test Investor',
      user_type: 'investor'
    }
  });
  
  console.log('First message response:', msg1?.message?.substring(0, 200) + '...');
  console.log('Learned preferences:', msg1?.learned_preferences);
  
  // Second message - ask about deals
  const { data: msg2 } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      message: "What deals are available that match my preferences?",
      user_id: investorId,
      user_name: 'Test Investor',
      user_type: 'investor',
      conversation_history: [
        { role: 'user', content: "I'm a beginner investor looking to invest $15,000-25,000 in STR properties in Austin or Tampa" },
        { role: 'assistant', content: msg1?.message }
      ]
    }
  });
  
  console.log('Second message response:', msg2?.message?.substring(0, 200) + '...');
  
  // Get stored preferences
  const { data: prefs } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      action: 'get_investor_preferences',
      user_id: investorId
    }
  });
  
  console.log('Stored preferences:', prefs);
  
  return { msg1, msg2, prefs };
}

const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testPennyPreferenceMemory(stored.id);
```

### Test 2.3: Test Penny AI Portfolio Insights
```javascript
async function testPennyPortfolioInsights(investorId) {
  console.log('Testing Penny AI portfolio insights...');
  
  const { data } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      action: 'get_investor_insights',
      user_id: investorId
    }
  });
  
  console.log('Portfolio insights:', data);
  return data;
}

const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testPennyPortfolioInsights(stored.id);
```

---

## Part 3: Deal Marketplace Tests

### Test 3.1: Create Marketplace Listing
```javascript
async function testCreateMarketplaceListing(investorId, investorName, investorEmail) {
  console.log('Creating marketplace listing...');
  
  const listingData = {
    title: 'Profitable Austin STR - 3BR/2BA',
    description: 'Well-established short-term rental with consistent bookings. Great location near downtown.',
    property_address: '456 Market St',
    property_city: 'Austin',
    property_state: 'TX',
    property_zip: '78702',
    bedrooms: 3,
    bathrooms: 2,
    operation_type: 'str',
    monthly_revenue: 4500,
    monthly_expenses: 1800,
    asking_price: 35000,
    lease_remaining_months: 18,
    reason_for_selling: 'Relocating to another state',
    photo_urls: []
  };
  
  const { data, error } = await window.supabase.functions.invoke('manage-deal-marketplace', {
    body: {
      action: 'create_listing',
      investor_id: investorId,
      investor_name: investorName,
      investor_email: investorEmail,
      listing_data: listingData
    }
  });
  
  if (error || !data?.success) {
    console.error('Create listing failed:', error || data?.error);
    return null;
  }
  
  console.log('Listing created:', data);
  return data;
}

const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testCreateMarketplaceListing(stored.id, stored.full_name, stored.email);
```

### Test 3.2: Check Verification Queue (Staff)
```javascript
async function testVerificationQueue() {
  console.log('Checking verification queue...');
  
  const { data, error } = await window.supabase.functions.invoke('manage-deal-marketplace', {
    body: {
      action: 'get_verification_queue'
    }
  });
  
  if (error) {
    console.error('Get queue failed:', error);
    return null;
  }
  
  console.log('Verification queue:', data);
  return data;
}

await testVerificationQueue();
```

---

## Part 4: AM Assignment Tests

### Test 4.1: Submit AM Assignment Request
```javascript
async function testSubmitAMRequest(investorId, investorName) {
  console.log('Submitting AM assignment request...');
  
  const { data, error } = await window.supabase.functions.invoke('manage-staff', {
    body: {
      action: 'submit_am_assignment_request',
      investor_id: investorId,
      investor_name: investorName,
      preferred_markets: ['Austin, TX', 'Tampa, FL'],
      budget_range: '$15,000 - $25,000',
      notes: 'Looking for STR properties with good ROI potential'
    }
  });
  
  if (error || !data?.success) {
    console.error('Submit request failed:', error || data?.error);
    return null;
  }
  
  console.log('AM request submitted:', data);
  return data;
}

const stored = JSON.parse(localStorage.getItem('investorSession') || '{}');
await testSubmitAMRequest(stored.id, stored.full_name);
```

### Test 4.2: Get Pending AM Requests (Staff)
```javascript
async function testGetAMRequests() {
  console.log('Getting pending AM requests...');
  
  const { data, error } = await window.supabase.functions.invoke('manage-staff', {
    body: {
      action: 'get_am_assignment_requests'
    }
  });
  
  if (error) {
    console.error('Get requests failed:', error);
    return null;
  }
  
  console.log('Pending AM requests:', data);
  return data;
}

await testGetAMRequests();
```

---

## Part 5: Deal Workflow Tests (Staff Dashboard)

### Test 5.1: Create New Deal
```javascript
async function testCreateDeal() {
  console.log('Creating new deal...');
  
  const dealData = {
    address: '123 Test Ave',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    bedrooms: 3,
    bathrooms: 2,
    monthly_rent: 2800,
    property_type: 'single_family',
    operation_type: 'str',
    description: 'Test property for workflow testing',
    landlord_name: 'Test Landlord',
    landlord_phone: '555-987-6543',
    landlord_email: 'landlord@test.com'
  };
  
  const { data, error } = await window.supabase.functions.invoke('add-property', {
    body: dealData
  });
  
  if (error || !data?.success) {
    console.error('Create deal failed:', error || data?.error);
    return null;
  }
  
  console.log('Deal created:', data);
  return data;
}

await testCreateDeal();
```

### Test 5.2: Move Deal Through Kanban Stages
```javascript
async function testKanbanWorkflow(propertyId) {
  const stages = ['new', 'researching', 'landlord_contact', 'negotiating', 'approved', 'published'];
  
  for (let i = 1; i < stages.length; i++) {
    console.log(`Moving deal to stage: ${stages[i]}`);
    
    const { data, error } = await window.supabase.functions.invoke('update-property', {
      body: {
        property_id: propertyId,
        updates: {
          workflow_stage: stages[i],
          is_published: stages[i] === 'published'
        }
      }
    });
    
    if (error || !data?.success) {
      console.error(`Failed to move to ${stages[i]}:`, error || data?.error);
      return false;
    }
    
    console.log(`Moved to ${stages[i]}:`, data);
    await new Promise(r => setTimeout(r, 500)); // Small delay between stages
  }
  
  console.log('Deal successfully moved through all stages!');
  return true;
}

// Execute with property ID from test 5.1
await testKanbanWorkflow('property-id-here');
```

### Test 5.3: Test Penny AI Finding the Deal
```javascript
async function testPennyFindsDeal() {
  console.log('Testing if Penny can find Austin deals...');
  
  const { data } = await window.supabase.functions.invoke('ai-investor-chat', {
    body: {
      message: 'What deals are available in Austin?',
      user_name: 'Test User',
      user_type: 'investor'
    }
  });
  
  console.log('Penny response:', data?.message);
  console.log('Deals found:', data?.deals_available);
  
  return data;
}

await testPennyFindsDeal();
```

---

## Full Automated Test Runner

```javascript
async function runFullTestSuite() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  const runTest = async (name, testFn) => {
    console.log(`\n========== Running: ${name} ==========`);
    try {
      const result = await testFn();
      if (result) {
        results.passed++;
        results.tests.push({ name, status: 'PASSED', result });
        console.log(`✅ ${name} PASSED`);
      } else {
        results.failed++;
        results.tests.push({ name, status: 'FAILED', result: null });
        console.log(`❌ ${name} FAILED`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'ERROR', error: error.message });
      console.error(`❌ ${name} ERROR:`, error);
    }
  };
  
  // Run tests
  await runTest('Session Validation', testSessionValidation);
  await runTest('Penny Market Data', testPennyMarketData);
  await runTest('Penny Suggested Questions', async () => {
    const { data } = await window.supabase.functions.invoke('ai-investor-chat', {
      body: { action: 'get_suggested_questions', user_type: 'investor' }
    });
    return data?.success && data?.suggestions?.length > 0;
  });
  
  // Summary
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}`);
  
  return results;
}

// Run the full test suite
await runFullTestSuite();
```

---

## Rollback Procedures

### Rollback Investor Data
```javascript
async function rollbackTestInvestor(email) {
  // This would require admin access to delete test data
  console.log('Rollback not implemented - requires admin access');
}
```

### Rollback Test Properties
```javascript
async function rollbackTestProperties(investorId) {
  const { data } = await window.supabase.functions.invoke('investor-auth', {
    body: {
      action: 'get_portfolio_properties',
      investor_id: investorId
    }
  });
  
  if (data?.properties) {
    for (const prop of data.properties) {
      if (prop.address.includes('Test')) {
        await window.supabase.functions.invoke('investor-auth', {
          body: {
            action: 'delete_portfolio_property',
            investor_id: investorId,
            property_id: prop.id
          }
        });
        console.log('Deleted test property:', prop.address);
      }
    }
  }
}
```

---

## Notes

1. **Session Required**: Most tests require an active investor session. Run login test first.
2. **Staff Tests**: Some tests (verification queue, AM requests) require staff dashboard access.
3. **Timeouts**: Edge functions may timeout on first call due to cold starts. Retry if needed.
4. **Cache Testing**: Session validation caching can be tested by comparing response times.
5. **Penny AI**: AI responses may vary; check for key data points rather than exact matches.
