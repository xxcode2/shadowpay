## 🚀 Railway Environment Setup

### BACKEND Service Variables

Go to Railway Dashboard → Backend Service → Variables → Add:

```bash
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
PORT=3333
NODE_ENV=production
```

### RELAYER Service Variables

Go to Railway Dashboard → Relayer Service → Variables → Add:

```bash
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
RELAYER_KEYPAIR_PATH=/app/relayer.json
PORT=4444
NODE_ENV=production
```

**CRITICAL:** `RELAYER_AUTH_SECRET` must be IDENTICAL in both services!

##1. Test relayer directly (with auth)
curl -X POST https://shadowpay-production-8362.up.railway.app/deposit \
  -H "Content-Type: application/json" \
  -H "x-relayer-auth: shadowpay-relayer-secret-123" \
  -d '{"amount":0.0001,"linkId":"test-relayer"}'

# 2. Test via backend (backend forwards to relayer)
curl -X POST https://your-backend-url.railway.app/api/privacy/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount":0.0001,"linkId":"test-backend"}'

# Expected: {"success": true, "txSignature": "..."}
# Time: 10-30s (ZK proof generation)Deploy

```bash
# Wait 1-2 minutes for Railway redeploy

# Test health
curl https://shadowpay-production-8362.up.railway.app/health

# Test deposit (should complete in 5-10s)
curl -X POST https://shadowpay-production-8362.up.railway.app/deposit \
  -H "Content-Type: application/json" \
  -H "x-relayer-auth: shadowpay-relayer-secret-123" \
  -d '{"lamports": 5000000}'

# Expected: {"success": true, "tx": "..."}
# Time: 5-10s ✅
```

### If Still Issues

Check Railway logs:
```bash
railway logs --tail 100
```

Common issues:
- ALT not found → PrivacyCash SDK need initialization
- Still timeout → Increase to mainnet RPC or use premium tier
- Authentication error → Verify RELAYER_SECRET matches
