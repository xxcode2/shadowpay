# 🚀 Railway Relayer Service Setup Guide

## Problem Solved

❌ **BEFORE:** Backend at `http://localhost:4444` in production (refers to backend container)  
✅ **AFTER:** Backend calls real Railway relayer service URL via `RELAYER_URL` environment variable

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Railway.app                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐        ┌──────────────────────┐   │
│  │   Backend Service   │        │  Relayer Service     │   │
│  │   (Lightweight)     │        │  (ZK Heavy Worker)   │   │
│  │                     │        │                      │   │
│  │  Port: 3333         │        │  Port: 4444          │   │
│  │  Memory: 256MB      │        │  Memory: 1GB+        │   │
│  │                     │        │                      │   │
│  │  Routes:            │        │  Endpoints:          │   │
│  │  - /health          │        │  - GET  /health      │   │
│  │  - /links/:id/pay   │──────→ │  - POST /deposit     │   │
│  │  - /links/:id/claim │        │  - POST /withdraw    │   │
│  │                     │        │                      │   │
│  │  RELAYER_URL env    │        │  PORT env var        │   │
│  │  https://...relay...│────────│  (auto-generated)    │   │
│  └─────────────────────┘        └──────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Relayer Service in Railway

### Option A: Using Railway CLI
```bash
# From workspace root
cd relayer
railway link  # Select existing project
railway service  # Create new service from this directory
```

### Option B: Using Railway Dashboard
1. Go to [railway.app](https://railway.app)
2. Select your ShadowPay project
3. Click "New" → "GitHub Repo"
4. Connect to your fork
5. Set deploy path to `/relayer`

### What Gets Created
- New service: `shadowpay-relayer` (or similar)
- Unique Railway domain: `https://shadowpay-relayer.up.railway.app`
- Auto-assigns PORT via environment variable
- Separate container from backend

---

## Step 2: Configure Relayer Environment Variables

In Railway Dashboard → Relayer Service → Variables:

```bash
PORT=                    # AUTO (Railway assigns this)
NODE_ENV=production      # EXPLICIT
SOLANA_RPC_URL=https://api.devnet.solana.com
RELAYER_KEYPAIR_PATH=./relayer.json
RELAYER_SECRET=<generate-uuid>   # Optional, for auth
SERVICE_URL=             # Will be auto-populated as domain
```

### Key Points
- **PORT**: Auto-assigned by Railway (DON'T set manually)
- **NODE_ENV**: Must be `production` for validation
- **SOLANA_RPC_URL**: Must match backend's config
- **RELAYER_KEYPAIR_PATH**: Must match file in repo

---

## Step 3: Update Backend Service

In Railway Dashboard → Backend Service → Variables:

**ADD/UPDATE this variable:**
```bash
RELAYER_URL=https://shadowpay-relayer.up.railway.app
```

**Optional (for timeouts):**
```bash
RELAYER_TIMEOUT=30000    # 30 seconds (default)
```

### How Backend Uses This
```javascript
// In /server/index.js
const RELAYER_URL = process.env.RELAYER_URL;
const RELAYER_TIMEOUT = parseInt(process.env.RELAYER_TIMEOUT || '30000', 10);

// During payment:
fetch(`${RELAYER_URL}/deposit`, {
  method: "POST",
  signal: AbortSignal.timeout(RELAYER_TIMEOUT)
  // ...
})
```

---

## Step 4: Fund Relayer Wallet

The relayer keypair (`89dQq1YgasQ88E72tu6qPFmMSe1QNSbD4y647RxuoXN5`) needs SOL for gas fees.

### Get Free Devnet SOL
```bash
# Using Solana CLI
solana airdrop 10 --url devnet

# Using web airdrop (if above rate-limited):
# https://faucet.solana.com/?amount=10&cluster=devnet
```

### Verify Balance
```bash
curl https://shadowpay-relayer.up.railway.app/health

# Response:
{
  "ok": true,
  "relayer": "89dQq1YgasQ88E72tu6qPFmMSe1QNSbD4y647RxuoXN5",
  "balance": 10.5,
  "rpcUrl": "https://api.devnet.solana.com"
}
```

---

## Step 5: Test End-to-End

### Test 1: Relayer Health
```bash
curl https://shadowpay-relayer.up.railway.app/health
```

Expected: `{"ok": true, "relayer": "...", "balance": X}`

### Test 2: Backend Health
```bash
curl https://shadowpay-production.up.railway.app/health
```

Expected: Should show relayer URL in response

### Test 3: Create Payment Link
```bash
curl -X POST https://shadowpay-production.up.railway.app/links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.01,
    "creator_id": "test-user"
  }'
```

### Test 4: Process Payment
```bash
curl -X POST https://shadowpay-production.up.railway.app/links/LINK_ID/pay \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.01,
    "payerWallet": "wallet_address",
    "token": "auth_token"
  }'
```

Expected logs in backend:
```
📡 Forwarding to relayer: POST https://shadowpay-relayer.up.railway.app/deposit
✅ Payment processed via relayer: tx_signature
```

---

## Step 6: Monitor Services

### Backend Logs
```
🚀 Backend running on port 3333
🔁 Relayer at: https://shadowpay-relayer.up.railway.app
⏱️  Relayer timeout: 30000ms
📡 Forwarding to relayer: POST https://...
```

### Relayer Logs
```
🚀 Relayer running on port 4444
✅ Privacy Cash client initialized for relayer
💰 Depositing 0.01 SOL to Privacy Cash...
✅ Deposit successful: tx_signature
```

### Memory Usage
- Backend: Should stay **< 200MB**
- Relayer: Can spike to **1.2GB** during ZK proof (normal)

---

## Troubleshooting

### Error: "RELAYER_URL not configured"
**Solution:** Set `RELAYER_URL` in backend Railway variables

### Error: "Request to relayer failed (connection timeout)"
**Symptoms:** Payment hangs for 30+ seconds then fails
**Cause:** Relayer service not running or unreachable
**Solution:**
1. Check relayer service status in Railway dashboard
2. Verify relayer has PORT environment variable set
3. Check relayer logs for startup errors
4. Restart relayer service

### Error: "Relayer error (500): Deposit failed"
**Symptoms:** Relayer returns server error
**Cause:** Usually insufficient SOL balance
**Solution:** Fund relayer wallet with devnet SOL
```bash
solana airdrop 5 89dQq1YgasQ88E72tu6qPFmMSe1QNSbD4y647RxuoXN5 --url devnet
```

### Error: "Invalid RELAYER_URL format"
**Symptoms:** Backend starts but can't connect
**Cause:** RELAYER_URL missing `https://` prefix
**Solution:** Ensure full URL: `https://shadowpay-relayer.up.railway.app`

### Error: "FATAL: PORT environment variable must be set"
**Symptoms:** Relayer won't start in production
**Cause:** NODE_ENV=production but PORT not set
**Solution:**
1. In Railway, ensure PORT is in variables (Railway auto-assigns)
2. Or change NODE_ENV to `development` (dev only)

---

## Production Checklist

- [ ] Relayer service deployed to Railway
- [ ] Relayer PORT environment variable set (auto or explicit)
- [ ] Relayer NODE_ENV = `production`
- [ ] Backend RELAYER_URL points to relayer domain
- [ ] Backend NODE_ENV = `production`
- [ ] Both services use SOLANA_RPC_URL=https://api.devnet.solana.com
- [ ] Relayer wallet funded with devnet SOL
- [ ] Relayer /health returns `{"ok": true}`
- [ ] Backend /health shows relayer URL
- [ ] Test payment flow creates transaction
- [ ] Monitor logs for errors
- [ ] Memory usage stable (no OOM kills)

---

## Quick Reference: Environment Variables

### Backend Service (server/.env or Railway)
```
PORT=3333
RELAYER_URL=https://shadowpay-relayer.up.railway.app
RELAYER_TIMEOUT=30000
SOLANA_RPC_URL=https://api.devnet.solana.com
JWT_SECRET=<random-secret>
PRIVATE_KEY=<keypair-base58>
FRONTEND_ORIGIN=https://frontend-domain.com
```

### Relayer Service (relayer/.env or Railway)
```
PORT=4444  # AUTO in Railway
NODE_ENV=production
SOLANA_RPC_URL=https://api.devnet.solana.com
RELAYER_KEYPAIR_PATH=./relayer.json
RELAYER_SECRET=<optional-auth>
SERVICE_URL=https://shadowpay-relayer.up.railway.app
```

---

## Architecture Files Changed

Updated files for production deployment:
- `/server/index.js` - Add RELAYER_URL validation and timeout handling
- `/relayer/index.js` - Add PORT and NODE_ENV validation
- Both files now prevent localhost fallbacks in production

See these docs for context:
- `ARCHITECTURE_OOM_FIX.md` - Why ZK moved to relayer
- `OOM_REFACTOR_COMPLETE.md` - Refactor completion details
- `RAILWAY_DEPLOYMENT_GUIDE.md` - General deployment info
