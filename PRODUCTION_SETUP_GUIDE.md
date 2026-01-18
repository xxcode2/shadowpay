# ShadowPay Production Setup Guide

## Architecture Overview

**This is a MAINNET deployment with cross-origin services:**

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                      │
│  https://shadowpay-seven.vercel.app                    │
│                                                         │
│  - VITE_API_URL=https://shadowpay-production.up.railway.app/api
│  - VITE_SOLANA_NETWORK=mainnet                        │
└─────────────┬───────────────────────────────────────────┘
              │ HTTPS (Cross-Origin)
              ↓
┌─────────────────────────────────────────────────────────┐
│  Backend (Railway)                                      │
│  https://shadowpay-production.up.railway.app           │
│                                                         │
│  - Receives API calls from frontend                    │
│  - Calls Relayer service                               │
│  - RELAYER_URL=https://shadowpay-production-8362.up.railway.app  │
└─────────────┬───────────────────────────────────────────┘
              │ HTTPS
              ↓
┌─────────────────────────────────────────────────────────┐
│  Relayer (Railway)                                      │
│  https://shadowpay-production-8362.up.railway.app      │
│                                                         │
│  - Receives deposit/withdraw requests                  │
│  - Signs transactions with relayer keypair             │
│  - Submits to Solana MAINNET                          │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ CRITICAL: Railway Environment Variables

**You MUST set these in Railway dashboard** (not in .env files):

### Backend Service (shadowpay-production)

```
# REQUIRED - Relayer Service URL
RELAYER_URL=https://shadowpay-production-8362.up.railway.app

# REQUIRED - JWT Secret (must match relayer's)
JWT_SECRET=<generate-with-openssl-rand-hex-32>

# REQUIRED - Private Key for withdrawals (Solana keypair)
PRIVATE_KEY=<base58-encoded-solana-keypair>

# REQUIRED - Service role key (Supabase)
SUPABASE_SERVICE_ROLE_KEY=<from-supabase>

# Optional - Customize CORS origins
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://shadowpay-seven.vercel.app

# Solana Configuration (Already correct in .env)
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
SOLANA_NETWORK=mainnet-beta
```

### Relayer Service (shadowpay-production-8362)

```
# REQUIRED - Private key for relayer signing
PRIVATE_KEY=<relayer-keypair-base58>

# REQUIRED - Must match backend JWT secret
RELAYER_AUTH_SECRET=<same-as-backend>

# Solana Configuration
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
SOLANA_NETWORK=mainnet-beta
```

---

## 🔧 Setup Steps

### Step 1: Update Backend Environment Variables

In Railway dashboard > Backend Service > Variables:

```
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
JWT_SECRET=<generate>
PRIVATE_KEY=<set>
SUPABASE_SERVICE_ROLE_KEY=<set>
```

**How to generate JWT_SECRET:**
```bash
openssl rand -hex 32
```

### Step 2: Verify Relayer Environment Variables

In Railway dashboard > Relayer Service > Variables:

Ensure `PRIVATE_KEY` and `RELAYER_AUTH_SECRET` are set.

### Step 3: Redeploy Both Services

```bash
# Push code to trigger Railway autodeploy
git push origin main

# Or manually deploy in Railway dashboard
```

### Step 4: Verify CORS

Frontend should be able to call backend:

```bash
curl -v https://shadowpay-production.up.railway.app/api/health
```

Should return:
```json
{
  "ok": true,
  "uptime": 12345,
  "relayer": true
}
```

### Step 5: Test Payment Link Creation

1. Open https://shadowpay-seven.vercel.app
2. Connect Solana wallet
3. Create a new payment link
4. Should succeed with no CORS errors

---

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot POST /api/links" (404 Error)

**Cause**: Frontend VITE_API_URL not set correctly

**Verify**: 
- vercel.json should have: `"VITE_API_URL": "https://shadowpay-production.up.railway.app/api"`
- Redeploy frontend after fixing

### Issue 2: "CORS policy violation"

**Cause**: Backend doesn't allow frontend origin

**Fix**:
```bash
# In Railway backend environment variables:
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://shadowpay-seven.vercel.app

# Restart backend service
```

### Issue 3: Relayer connection refused

**Cause**: Backend can't reach relayer at configured URL

**Fix**:
```bash
# Verify relayer service is running:
curl https://shadowpay-production-8362.up.railway.app/health

# If fails, check Railway logs for relayer service
# Ensure RELAYER_URL is exactly: https://shadowpay-production-8362.up.railway.app
```

### Issue 4: Wallet connecting to Testnet instead of Mainnet

**Cause**: VITE_SOLANA_NETWORK not set to mainnet

**Verify**:
- vercel.json should have: `"VITE_SOLANA_NETWORK": "mainnet"`
- Frontend should show "Mainnet" in UI
- Redeploy if needed

---

## 📋 Network Configuration

**This deployment uses MAINNET**, not testnet:

| Setting | Value |
|---------|-------|
| Solana Network | MAINNET (mainnet-beta) |
| RPC Endpoint | https://mainnet.helius-rpc.com/ |
| Privacy Cash | Mainnet only (no testnet contracts) |
| Tokens | Real SOL and USDC |

⚠️ **Warning**: Transactions are real and irreversible on mainnet!

---

## 🔐 Security Checklist

- [ ] JWT_SECRET is a random 32-byte hex string (not "dev-secret")
- [ ] PRIVATE_KEY is stored securely (never commit to repo)
- [ ] CORS_ORIGIN restricts to known domains
- [ ] RELAYER_URL is exactly: `https://shadowpay-production-8362.up.railway.app`
- [ ] Relayer service is running and healthy
- [ ] Backend can reach relayer (test with curl)
- [ ] Frontend redirects HTTP to HTTPS
- [ ] All secrets rotated for production

---

## 📞 Troubleshooting

### Check Backend Logs
```bash
# In Railway dashboard:
# Backend Service > Logs
# Look for error messages related to RELAYER_URL or CORS
```

### Check Relayer Logs
```bash
# In Railway dashboard:
# Relayer Service > Logs
# Look for connection errors or signing failures
```

### Test API Directly
```bash
# Create payment link
curl -X POST https://shadowpay-production.up.railway.app/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1,
    "token": "SOL",
    "creator_id": "wallet_address",
    "expiryHours": 24
  }'

# Response should include link URL
```

---

## 🚀 Deployment Checklist

Before going live:

- [ ] Frontend builds without errors: `npm run build`
- [ ] Backend starts without errors: `npm start`
- [ ] All environment variables set in Railway
- [ ] CORS configured for frontend domain
- [ ] RELAYER_URL points to correct service
- [ ] Wallet connects to mainnet (not testnet)
- [ ] Test payment link creation
- [ ] Test deposit flow
- [ ] Test withdrawal flow
- [ ] Monitor logs for errors

---

## 📚 Related Files

- [Backend Configuration](./server/index.js)
- [Security & CORS](./server/security.js)
- [Environment Template](./server/.env)
- [Railway Setup Docs](./RAILWAY_SETUP.md)
