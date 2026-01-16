# 🔐 RELAYER CONFIGURATION

**PRODUCTION CREDENTIALS** - DO NOT SHARE PUBLICLY

---

## Relayer Service

**URL**: `https://shadowpay-production-8362.up.railway.app`  
**Auth Secret**: `shadowpay-relayer-secret-123`

---

## Environment Variables

### Backend (server/index.js)
```bash
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
```

### Relayer (relayer/index.js)
```bash
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
PRIVATE_KEY=your-solana-keypair
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
PORT=4444
```

### Frontend (if needed)
```bash
# Frontend does NOT need relayer credentials
# Frontend only talks to backend
VITE_API_URL=https://your-backend.railway.app
```

---

## Quick Setup

### 1. Backend Railway Service
```bash
# Set these environment variables in Railway dashboard:
RELAYER_URL=https://shadowpay-production-8362.up.railway.app
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
JWT_SECRET=your-jwt-secret
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

### 2. Relayer Railway Service  
```bash
# Already deployed at:
# https://shadowpay-production-8362.up.railway.app

# Environment variables:
RELAYER_AUTH_SECRET=shadowpay-relayer-secret-123
PRIVATE_KEY=your-solana-keypair
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
PORT=4444
```

---

## Testing

### Health Check
```bash
curl https://shadowpay-production-8362.up.railway.app/health
```

### Test Deposit (from backend)
```bash
curl -X POST https://shadowpay-production-8362.up.railway.app/deposit \
  -H "Content-Type: application/json" \
  -H "x-relayer-auth: shadowpay-relayer-secret-123" \
  -d '{
    "lamports": 100000000,
    "payerPublicKey": "YOUR_WALLET_ADDRESS",
    "linkId": "test123"
  }'
```

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `shadowpay-relayer-secret-123` to public repos
- Store in Railway environment variables only
- Rotate secret if exposed
- Use different secrets for dev/staging/production

🔒 **Access Control**:
- Only backend service should call relayer
- Relayer validates auth header on every request
- Frontend never talks directly to relayer

---

## Architecture Flow

```
Frontend
    ↓ (NO relayer credentials)
Backend (has RELAYER_URL + RELAYER_AUTH_SECRET)
    ↓ (x-relayer-auth: shadowpay-relayer-secret-123)
Relayer (validates RELAYER_AUTH_SECRET)
    ↓ (ZK proofs)
Blockchain
```

---

**Last Updated**: January 16, 2026  
**Status**: ✅ Production Configured
