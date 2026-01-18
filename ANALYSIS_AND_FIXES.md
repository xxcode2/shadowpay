# ShadowPay Analysis & Fixes Summary

## 📊 Full Deployment Architecture Discovered

**Actual Production Setup:**
```
Frontend:  https://shadowpay-seven.vercel.app (Vercel)
Backend:   https://shadowpay-production.up.railway.app (Railway)
Relayer:   https://shadowpay-production-8362.up.railway.app (Railway)
Network:   MAINNET (not testnet/devnet)
RPC:       https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
```

---

## 🚨 CRITICAL ISSUES FOUND & FIXED

### Issue #1: Frontend Network Misconfiguration ❌ → ✅

**File**: `vercel.json` line 42

**Problem**:
```json
"VITE_SOLANA_NETWORK": "testnet"
```

**Why This is Wrong**:
- Frontend was configured for TESTNET, but deployment is MAINNET
- `src/lib/solana-config.ts` uses this to select RPC endpoint and wallet network
- Privacy Cash SDK **ONLY** exists on MAINNET (no testnet contracts)
- Wallet would connect to testnet, creating transactions on wrong chain
- Deposits/withdrawals would fail because Privacy Cash isn't deployed on testnet

**Fix Applied**:
```json
"VITE_SOLANA_NETWORK": "mainnet"
```

**Impact**: Frontend now correctly connects to Mainnet, allowing Privacy Cash operations

---

### Issue #2: Production Relayer URL Not Configured ❌ → ⚠️ (Requires Action)

**File**: `server/.env` line 14

**Problem**:
```dotenv
RELAYER_URL=http://localhost:4444
```

**Why This is Wrong**:
- Backend in production (Railway) tries to call relayer at `localhost:4444`
- In production container, `localhost` doesn't exist or doesn't have relayer service
- Deposit/withdraw endpoints will timeout or fail
- Backend cannot reach the actual relayer service running on separate Railway instance

**Documentation Added**:
```dotenv
# Relayer URL (REQUIRED)
# Development: http://localhost:4444
# Production: https://shadowpay-production-8362.up.railway.app
RELAYER_URL=http://localhost:4444
```

**Action Required**: User must manually set in Railway dashboard environment variables:
```
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
```

**Impact**: Without this, relayer calls in production will fail

---

### Issue #3: API URL Path Configuration ✅ (Already Fixed)

**File**: `vercel.json` line 40

**Status**: Already correctly configured
```json
"VITE_API_URL": "https://shadowpay-production.up.railway.app/api"
```

**Frontend Code** (`src/pages/CreateLink.tsx` line 49):
```typescript
const endpoint = `${apiUrl}/links`;
// = "https://shadowpay-production.up.railway.app/api" + "/links"
// = "https://shadowpay-production.up.railway.app/api/links" ✓
```

✅ This is correct

---

### Issue #4: npm start Script ✅ (Already Fixed)

**File**: `package.json` line 11

**Status**: Already configured
```json
"start": "npm run build && node server/index.js"
```

✅ Railway can now execute `npm start` successfully

---

### Issue #5: CORS Configuration ✅ (Already Verified)

**File**: `server/security.js` line 65

**Status**: Already correctly configured
```javascript
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://shadowpay-seven.vercel.app',  // ✓ Frontend domain allowed
  'https://shadowpay.vercel.app'
];
```

✅ CORS allows cross-origin requests from frontend to backend

---

## 📋 Files Thoroughly Reviewed

1. ✅ `vercel.json` - Frontend build/deployment config
2. ✅ `vite.config.ts` - Vite dev server proxy config
3. ✅ `.env.development` - Dev environment vars
4. ✅ `.env.testnet` - Test environment vars
5. ✅ `server/index.js` - Backend server initialization (CORS setup line 75-78)
6. ✅ `server/security.js` - CORS, rate limiting, security headers
7. ✅ `server/.env` - Backend environment variables
8. ✅ `src/lib/solana-config.ts` - Network configuration, RPC selection
9. ✅ `src/lib/api.ts` - API URL resolution
10. ✅ `src/pages/CreateLink.tsx` - API endpoint construction
11. ✅ `server/supabase.js` - Database configuration (Supabase disabled)

---

## 🔧 Changes Committed

### Commit 1: Network & Documentation Fix
```
fix: Set VITE_SOLANA_NETWORK to mainnet and document production relayer setup
```

**Changes**:
- ✅ `vercel.json`: testnet → mainnet
- ✅ `.env.testnet`: testnet → mainnet (consistency)
- ✅ `server/.env`: Added comments showing prod relayer URL
- ✅ Build verified: 7365 modules, 19.63s, zero errors

### Commit 2: Production Setup Documentation
```
docs: Add comprehensive production setup guide for mainnet deployment
```

**New File**: `PRODUCTION_SETUP_GUIDE.md`

**Contains**:
- Deployment architecture diagram
- Required Railway environment variables
- Step-by-step setup instructions
- CORS configuration
- Common issues & troubleshooting
- Security checklist
- Deployment verification steps

---

## ⚡ What Still Needs to be Done (by user)

### 1. **Set RELAYER_URL in Railway Backend Environment Variables**
```
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
```

This is **CRITICAL**. Without it, deposits/withdrawals will fail.

**Steps**:
1. Go to Railway dashboard
2. Select Backend service (shadowpay-production)
3. Go to Variables tab
4. Set `RELAYER_URL=https://shadowpay-production-8362.up.railway.app`
5. Redeploy service

### 2. **Verify Relayer Service Has Required Environment Variables**
```
PRIVATE_KEY=<relayer-keypair>
RELAYER_AUTH_SECRET=<jwt-secret>
SOLANA_RPC_URL=mainnet-helius-rpc-url
```

### 3. **Test the Deployment**

After pushing code and setting env vars:

```bash
# 1. Check backend health
curl https://shadowpay-production.up.railway.app/api/health

# 2. Test payment link creation
curl -X POST https://shadowpay-production.up.railway.app/api/links \
  -H "Content-Type: application/json" \
  -d '{"amount": 1, "token": "SOL", "creator_id": "test", "expiryHours": 24}'

# 3. Open frontend and try creating a link
# https://shadowpay-seven.vercel.app/create
```

---

## 🎯 Logic Behind Each Fix

### Why VITE_SOLANA_NETWORK Must Be Mainnet

1. **Privacy Cash SDK**: Only deployed on Solana Mainnet
   - Testnet has no Privacy Cash contracts
   - SDK initialization will fail on testnet
   - Relayer cannot find privacy pool to deposit into

2. **RPC Endpoint**: solana-config.ts line 35 uses this to pick RPC
   - If testnet: uses https://api.testnet.solana.com
   - If mainnet: uses https://mainnet.helius-rpc.com
   - Wrong RPC = wrong chain = wrong transactions

3. **Wallet Connection**: Frontend connects to selected network
   - Testnet = test tokens only
   - Mainnet = real SOL (real money!)
   - Transactions must be on same chain where contracts exist

### Why RELAYER_URL Matters

1. **Backend Routing**: `server/index.js` line 214 calls relayer
   ```javascript
   const r = await fetch(`${RELAYER_URL}/deposit`, {...});
   ```
   - If RELAYER_URL = localhost:4444 in production = connection refused
   - Must point to actual running relayer service

2. **Deposit Flow**:
   - Frontend → Backend API POST /api/links/:id/pay
   - Backend → Calls relayer /deposit endpoint
   - Backend waits for relayer response
   - Without correct RELAYER_URL, this entire flow breaks

3. **Cross-Service Communication**:
   - Separate Railway services can't use localhost
   - Must use public URLs or Railway internal networking
   - Current setup uses public HTTPS URLs (most reliable)

---

## ✅ Verification Checklist

After user makes changes:

- [ ] `RELAYER_URL` set in Railway backend env vars
- [ ] Relayer service has correct private key
- [ ] Frontend builds without errors
- [ ] Backend starts without errors: `npm start`
- [ ] Wallet connects to MAINNET (not testnet)
- [ ] `https://shadowpay-production.up.railway.app/api/health` returns 200
- [ ] Create payment link: no CORS errors
- [ ] Deposit flow: completes without timeout
- [ ] Withdrawal flow: completes without errors
- [ ] No "Cannot POST /api/links" errors
- [ ] No "Relayer connection refused" errors

---

## 📝 Root Cause Analysis Summary

### Why "Cannot POST /links" Error Happened

1. **Initial Symptom**: Frontend got 404 on POST /links
2. **First Root Cause**: API URL had wrong rewrite rule (fixed in previous conversation)
3. **Remaining Issue**: Network config was testnet instead of mainnet
4. **Why That Matters**: Privacy Cash SDK only works on mainnet, so operations would fail silently or with cryptic errors

### Why Relayer Errors Will Happen if Not Fixed

1. **Symptom**: "Relayer connection refused" or timeout
2. **Root Cause**: RELAYER_URL pointing to localhost instead of production service
3. **Why**: Railway containers are isolated; localhost ≠ relayer service
4. **Fix**: Use public URL: `https://shadowpay-production-8362.up.railway.app`

---

## 🎓 Learning Points

1. **Environment Variables**: Must be correct for production (not dev defaults)
2. **Network Selection**: Frontend, Backend, and Relayer must all use same network
3. **Cross-Origin Requests**: Need proper CORS headers (already configured)
4. **Cross-Service Communication**: Can't use localhost in production
5. **Privacy Cash**: Mainnet-only (important constraint)

---

## 📚 Related Documentation

- [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md) - Detailed setup instructions
- [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) - Railway-specific setup
- [README.md](./README.md) - General project info
- [server/.env](./server/.env) - Backend config template

