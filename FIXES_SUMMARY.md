# 🔧 ShadowPay Fixes Summary

## Problems Identified and Fixed

### 1. **🔴 ROOT CAUSE: Supabase ENV Variables Not Loaded**

**Problem:**
- Project was using `process.env.NEXT_PUBLIC_SUPABASE_URL` (Next.js format)
- But this is a **Vite project**, which uses `import.meta.env.VITE_*` format
- `.env.development` file **did NOT contain** Supabase credentials
- Result: Supabase client initialized with undefined values, causing all DB operations to fail

**Files Changed:**
- `/src/lib/supabaseClient.ts` - Updated to use Vite format with fail-fast error checking

**Fixes Applied:**
```typescript
// BEFORE (Wrong - Next.js format)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// AFTER (Correct - Vite format)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Also added explicit error checking
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('🔴 CRITICAL: Supabase env vars not found!');
  throw new Error('Supabase not configured');
}
```

**What You Need To Do:**
1. Create `.env.local` file (already created with template)
2. Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. **RESTART dev server** (Vite doesn't hot-reload env vars)
   ```bash
   CTRL + C
   npm run dev
   ```

---

### 2. **🔴 ISSUE: Payment Links Not Showing in Dashboard**

**Root Cause:**
- Backend endpoint `/api/payment-links` did **NOT EXIST**
- Dashboard tried to fetch from non-existent endpoint → failed silently
- Server wasn't tracking `creator_id` when links were created

**Files Changed:**
- `/server/index.js` - Added 2 new endpoints + updated POST /links to capture creator_id

**Fixes Applied:**

#### a) Updated `POST /links` to save creator_id
```javascript
// Now accepts and saves:
- creator_id (wallet address of link creator)
- linkUsageType (reusable vs one-time)
- amountType (fixed vs any amount)
```

#### b) Added `GET /api/payment-links` endpoint
Returns all payment links created by the current user:
```
GET /api/payment-links?user_id=wallet-address
Returns: { links: [...] }
```

#### c) Added `GET /api/balance` endpoint
Returns total balance (sum of all paid links) for a user:
```
GET /api/balance?user_id=wallet-address
Returns: { balance: total-amount }
```

---

### 3. **🔴 ISSUE: Balance Showing 0 After Payment**

**Root Cause:**
- Dashboard wasn't passing `user_id` when fetching balance
- Backend balance calculation needed proper link status tracking
- Frontend wasn't associating payment with recipient's balance

**Files Changed:**
- `/src/lib/api.ts` - Updated `fetchDashboardData()` to pass user_id
- `/src/pages/Dashboard.tsx` - Integrated useWallet hook to get publicKey
- `/src/pages/CreateLink.tsx` - Save publicKey to localStorage and pass creator_id

**Fixes Applied:**

#### a) Dashboard Now Uses Wallet Info
```typescript
const { publicKey } = useWallet(); // Get user's wallet address
useEffect(() => {
  // Reload dashboard when wallet changes
  loadDashboard(publicKey);
}, [publicKey]); // Dependency on publicKey
```

#### b) CreateLink Saves Creator ID
```typescript
localStorage.setItem('walletAddress', publicKey);

await fetch('/links', {
  body: JSON.stringify({
    // ... other fields
    creator_id: publicKey,  // Now included
    linkUsageType,
    amountType
  })
});
```

#### c) API Fetches Pass User ID
```typescript
export async function fetchDashboardData(userId?: string) {
  const userIdForFetch = userId || localStorage.getItem('walletAddress');
  
  const balanceRes = await fetch(
    `/api/balance?user_id=${userIdForFetch}`  // Pass user_id
  );
  const linksRes = await fetch(
    `/api/payment-links?user_id=${userIdForFetch}`  // Pass user_id
  );
}
```

---

## How the Flow Now Works

### Creating a Payment Link:
```
User A clicks "Create Link"
  ↓
Frontend saves A's publicKey to localStorage
  ↓
POST /links {creator_id: A, amount: 100, ...}
  ↓
Backend stores link with creator_id = A
  ↓
Link appears in A's Dashboard (GET /api/payment-links?user_id=A)
```

### Receiving Payment:
```
User B clicks "Pay" on User A's link
  ↓
POST /links/{id}/pay {amount: 100}
  ↓
Backend:
  - Deposits to Privacy Cash
  - Sets link.paid = true
  - Updates link.payment_count++
  ↓
User A refreshes Dashboard
  ↓
GET /api/balance?user_id=A
  ↓
Backend calculates: sum of all (link.amount) where creator_id=A AND paid=true
  ↓
Dashboard shows User A's Private Balance = 100
```

---

## Quick Test Checklist

- [ ] 1. Add Supabase credentials to `.env.local`
- [ ] 2. Restart dev server (`npm run dev`)
- [ ] 3. Check browser console: should NOT see "Supabase env vars not found"
- [ ] 4. Connect wallet → navigate to Create Link
- [ ] 5. Create a payment link → should show success toast
- [ ] 6. Go to Dashboard → should see link in "Payment Links" table
- [ ] 7. Share link, simulate payment (or test with another wallet)
- [ ] 8. Go back to Dashboard → Balance should update
- [ ] 9. Check browser DevTools → Network tab shows `/api/payment-links` and `/api/balance` requests

---

## Files Modified

1. ✅ `/src/lib/supabaseClient.ts` - Fixed env variable format
2. ✅ `/src/lib/api.ts` - Updated fetchDashboardData to pass user_id
3. ✅ `/src/pages/CreateLink.tsx` - Added error handling and creator_id saving
4. ✅ `/src/pages/Dashboard.tsx` - Added useWallet integration
5. ✅ `/server/index.js` - Added new endpoints and updated POST /links
6. ✅ `/.env.local` - Created template with Supabase credentials

---

## Key Points to Remember

⚠️ **IMPORTANT: Env Variables**
- Vite uses `import.meta.env.VITE_*` NOT `process.env.*`
- File must be `.env.local` or `.env.development` (NOT `.env`)
- Must RESTART server after changing env vars (no hot-reload)

⚠️ **IMPORTANT: Creator ID Tracking**
- User's wallet address is now saved as `creator_id` when creating links
- Dashboard filters links by current user's wallet address
- Balance is calculated as sum of all paid links by that user

⚠️ **IMPORTANT: Error Handling**
- All API calls now have proper try-catch with user-friendly error messages
- Supabase client throws error on init if env vars missing (prevents silent failures)

---

## Next Steps (if issues persist)

1. **Check browser console** for any error messages
2. **Check Network tab** to see if API requests are being made
3. **Check terminal** where `npm run dev` is running for server logs
4. **Verify .env.local** has correct Supabase URL and key
5. **Hard refresh** browser (Ctrl+Shift+R) to clear old cache

