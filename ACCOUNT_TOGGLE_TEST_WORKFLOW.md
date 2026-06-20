# Staff/Investor Account Toggle Test Workflow

## Overview
This document outlines the test scenarios and expected behavior for the staff/investor account toggle functionality.

## Prerequisites
- A staff account with a linked investor account (same email or explicitly linked)
- Access to both Staff Dashboard and Investor Portal

---

## Test Scenario 1: Staff → Investor Switch

### Steps:
1. Log in as a staff member at `/staff/login`
2. Verify the staff dashboard loads with correct permissions
3. Look for "Investor Portal" button in the header (only visible if accounts are linked)
4. Click "Switch to Investor Portal" button

### Expected Results:
- ✅ Staff session is backed up to `staffSessionBackup` in localStorage
- ✅ Investor session is loaded with full investor data
- ✅ User is redirected to `/investor`
- ✅ Investor dashboard loads with correct data (name, email, preferences)
- ✅ Toast notification shows "Switched to Investor Portal"
- ✅ A banner appears: "You are viewing as an investor. Your staff session is preserved."
- ✅ "Return to Staff Dashboard" button is visible

### Verification Points:
```javascript
// Check localStorage
localStorage.getItem('staffSessionBackup') // Should contain staff session
localStorage.getItem('investorSession')    // Should contain investor data
```

---

## Test Scenario 2: Investor → Staff Switch

### Steps:
1. From the investor portal (after switching from staff)
2. Click "Return to Staff Dashboard" button in the banner
3. OR click the user menu and select "Return to Staff Dashboard"

### Expected Results:
- ✅ Staff session is restored from `staffSessionBackup`
- ✅ `staffSessionBackup` is cleared
- ✅ User is redirected to `/staff`
- ✅ Staff dashboard loads with correct permissions
- ✅ All tabs and features accessible based on department

### Verification Points:
```javascript
// Check localStorage
localStorage.getItem('staffSession')       // Should contain staff data
localStorage.getItem('staffSessionBackup') // Should be null
```

---

## Test Scenario 3: Direct Investor → Staff Switch (Linked Account)

### Steps:
1. Log in as an investor at `/investor/login`
2. Investor must have a linked staff account
3. Look for "Staff Dashboard" button in the header
4. Click "Switch to Staff Account"

### Expected Results:
- ✅ System calls `investor-auth` with `switch_to_staff` action
- ✅ Staff data is fetched including permissions from department
- ✅ Investor session is backed up to `investorSessionBackup`
- ✅ Staff session is created with full permissions
- ✅ User is redirected to `/staff`
- ✅ Toast notification shows "Switched to Staff Dashboard"

---

## Test Scenario 4: Cross-Tab Session Sync

### Steps:
1. Open Staff Dashboard in Tab 1
2. Open Investor Portal in Tab 2 (same browser)
3. Log out from Tab 1

### Expected Results:
- ✅ Tab 2 receives logout notification via BroadcastChannel
- ✅ Tab 2 automatically redirects to login page
- ✅ All session data is cleared in both tabs

---

## Test Scenario 5: Account Linking Wizard (Staff)

### Steps:
1. Log in as a staff member without a linked investor account
2. Go to Settings tab
3. Look for "Link Investor Account" option
4. Click to open the Account Linking Wizard

### Expected Results:
- ✅ Wizard checks if an investor account exists with the same email
- ✅ If found: Shows account details and offers to link
- ✅ If not found: Offers to create a new investor account
- ✅ On successful link: Staff session is updated with `linked_investor_id`
- ✅ "Switch to Investor" button becomes visible

---

## Known Issues & Edge Cases

### Issue 1: Session Expiration During Switch
- **Scenario**: Staff session expires while viewing as investor
- **Expected**: User should be prompted to re-authenticate
- **Current Behavior**: May cause errors during switch-back

### Issue 2: Permissions Not Loading
- **Scenario**: Staff switches to investor and back, permissions missing
- **Solution**: Ensure `switch_to_staff` action fetches department permissions

### Issue 3: Multiple Tab Conflicts
- **Scenario**: User logs in as different accounts in different tabs
- **Expected**: Most recent login should take precedence
- **Current Behavior**: May cause session conflicts

---

## API Endpoints Used

### staff-login
- `get_linked_investor`: Returns full investor data for staff member
- `link_investor_account`: Links staff account to investor account

### investor-auth
- `get_linked_staff`: Checks if investor has linked staff account
- `switch_to_staff`: Returns full staff data with permissions

---

## Session Storage Keys

| Key | Description |
|-----|-------------|
| `staffSession` | Current staff session data |
| `investorSession` | Current investor session data |
| `staffSessionBackup` | Backup of staff session when viewing as investor |
| `investorSessionBackup` | Backup of investor session when viewing as staff |
| `investorSessionToken` | JWT token for investor API calls |

---

## Troubleshooting

### "Could not load investor account data"
1. Check if `linked_investor_id` exists in staff session
2. Verify investor account exists in database
3. Check network tab for API errors

### "No linked staff account found"
1. Verify staff account exists with matching email
2. Check if `linked_staff_id` is set on investor record
3. Try linking accounts via Account Linking Wizard

### Toggle button not visible
1. Verify accounts are properly linked
2. Check localStorage for session data
3. Refresh the page to reload session state

---

## Version History
- v1.0 (2026-01-29): Initial documentation
- Added `get_linked_staff` and `switch_to_staff` actions to investor-auth
- Implemented real-time session sync with BroadcastChannel
- Created Account Linking Wizard for staff members
