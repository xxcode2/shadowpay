# 🚀 Railway Deployment Configuration - Post-Refactor

## Quick Reference

### Service 1: Backend (API Orchestrator)
- Port: 3333
- Memory Limit: 256MB (sufficient)
- CPU: Standard
- Entrypoint: `node server/index.js`
- Working Directory: `/app/server`

### Service 2: Relayer (ZK Worker)
- Port: 4444
- Memory Limit: 1GB+ (required for ZK)
- CPU: Standard+
- Entrypoint: `node relayer/index.js`
- Working Directory: `/app/relayer`

---

## Backend Service Configuration

### Environment Variables
```bash
PORT=3333
RELAYER_URL=http://relayer.railway.internal:4444
SOLANA_RPC_URL=https://api.devnet.solana.com
JWT_SECRET=<generated-secret>
PRIVATE_KEY=<relayer-keypair-base58>
FRONTEND_ORIGIN=https://shadowpay-seven.vercel.app
CORS_ORIGIN=https://shadowpay-seven.vercel.app,http://localhost:5173
```

### Why These Settings
- `RELAYER_URL=http://relayer.railway.internal:4444` - Internal Railway networking (fast)
- `SOLANA_RPC_URL=https://api.devnet.solana.com` - Devnet for testing
- `PRIVATE_KEY` - Used ONLY by relayer (forwarded via HTTP)
- `FRONTEND_ORIGIN` - For CORS and link generation

### Startup Script (package.json)
```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

### Health Check
```
Endpoint: GET http://localhost:3333/health
Expected: {"ok": true}
Timeout: 10s
Interval: 30s
```

### Deployment Checklist
- [ ] Set `RELAYER_URL` to relayer service internal domain
- [ ] Set `SOLANA_RPC_URL` to correct network
- [ ] Set `JWT_SECRET` (generate with openssl rand -hex 32)
- [ ] Set `PRIVATE_KEY` for relayer operations
- [ ] Set `FRONTEND_ORIGIN` to production domain
- [ ] Set memory limit to 512MB (more than enough)
- [ ] CPU: 1 standard

---

## Relayer Service Configuration

### Environment Variables
```bash
PORT=4444
SOLANA_RPC_URL=https://api.devnet.solana.com
RELAYER_KEYPAIR_PATH=./relayer.json
RELAYER_SECRET=<optional-auth-secret>
```

### Why These Settings
- `SOLANA_RPC_URL` - Same as backend (must match)
- `RELAYER_KEYPAIR_PATH=./relayer.json` - Private key file in repo
- `RELAYER_SECRET` - Optional auth (if set, backend must include in headers)

### Critical Requirements
- **Memory Limit: 1GB minimum** (ZK proof generation needs ~800MB)
- **CPU: Standard or higher** (WASM execution is CPU-intensive)
- **Disk: 500MB free** (circuits are large files)

### Health Check
```
Endpoint: GET http://localhost:4444/health
Expected: {"ok": true, "relayer": "...", "balance": X}
Timeout: 10s
Interval: 30s
```

### Startup Script (package.json)
```json
{
  "scripts": {
    "start": "node index.js"
  }
}
```

### Deployment Checklist
- [ ] Set `SOLANA_RPC_URL` to correct network
- [ ] Ensure `relayer.json` exists with keypair
- [ ] Set memory limit to 1GB or higher
- [ ] Set CPU to Standard (1 shared core minimum)
- [ ] Fund wallet: `89dQq1YgasQ88E72tu6qPFmMSe1QNSbD4y647RxuoXN5`
- [ ] Verify balance with `/health` endpoint

---

## Connection Between Services

### Internal Railway Network
When both services deployed to Railway, they automatically get internal networking:
- Backend can reach relayer at: `http://relayer.railway.internal:4444`
- No NAT, no external IP needed
- Fast and secure

### Configuration
```
Backend → fetch(`http://relayer.railway.internal:4444/deposit`)
             ↓
          HTTP call over internal network
             ↓
          Relayer processes request
             ↓
          Return { tx, commitment }
```

### Testing Connectivity
From backend logs:
```
📡 Forwarding to relayer: POST http://relayer.railway.internal:4444/deposit
```

---

## Monitoring & Debugging

### Backend Logs to Watch
```
✅ Backend running on :3333              - Startup success
📡 Forwarding to relayer: POST ...       - Payment received
❌ Relayer failed: ...                   - Relayer connection error
✅ Payment processed via relayer: ...    - Payment success
```

### Relayer Logs to Watch
```
✅ Privacy Cash client initialized       - Startup success
💰 Depositing X SOL to Privacy Cash      - Payment received
🧾 Generating ZK proof...                - ZK computation (2-5s)
✅ Deposit successful: ...               - Payment success
```

### Memory Monitoring
```bash
# Backend should stay under 200MB
# Relayer should stay under 1.2GB (spike to 1.5GB during ZK is OK)

# Railway dashboard shows:
# Memory usage graph for each service
# CPU usage for relayer (should spike during ZK generation)
```

### Common Issues

#### 502 Bad Gateway
**Cause:** Backend can't reach relayer
**Fix:** Check relayer internal domain, verify both services deployed

#### Timeout on /deposit
**Cause:** Relayer taking too long (normal: 2-5 seconds for ZK)
**Fix:** Increase timeout in backend fetch to 30 seconds

#### OOM Kill on Relayer
**Cause:** Memory limit too low for ZK proof generation
**Fix:** Increase relayer memory limit to 1.5GB or 2GB

#### Transaction Failed
**Cause:** Relayer wallet has no SOL (gas fees)
**Fix:** Fund `89dQq1YgasQ88E72tu6qPFmMSe1QNSbD4y647RxuoXN5` with devnet SOL

---

## Performance Expectations

### Backend Response Time
- With relayer available: 2-5.1 seconds (2s ZK proof + 0.1s overhead)
- Relayer timeout: 503 error in 30 seconds

### Relayer Processing Time
- Deposit: 2-3 seconds (ZK proof generation)
- Withdraw: 2-5 seconds (ZK proof generation)
- First request: +2 seconds (circuit loading)

### Memory Usage at Rest
- Backend: 80-100MB
- Relayer: 600-800MB

### Memory Usage Under Load
- Backend: 100-150MB
- Relayer: 1-1.5GB (normal during ZK generation)

---

## Production Checklist

### Before Deploying
- [ ] Test locally: both services start without errors
- [ ] Test connectivity: backend can reach relayer
- [ ] Test payment: backend forwards to relayer successfully
- [ ] Check memory: backend <100MB, relayer <1GB
- [ ] Fund relayer wallet with devnet SOL

### During Deployment
- [ ] Deploy relayer service first
- [ ] Wait for relayer health check to pass
- [ ] Deploy backend service
- [ ] Wait for backend health check to pass
- [ ] Test payment flow end-to-end

### After Deployment
- [ ] Monitor logs for errors
- [ ] Watch memory usage graphs
- [ ] Test multiple payments in succession
- [ ] Verify frontend can process payments
- [ ] Check Solscan for transactions

---

## Rollback Plan

If something breaks:

1. **Quick Fix (5 min)**
   - Check relayer logs for crashes
   - Restart relayer service if needed
   - Backend will retry automatically

2. **Full Rollback (15 min)**
   - Rollback backend to previous commit
   - Rollback relayer to previous commit
   - Verify both services restart cleanly

3. **Emergency Disable**
   - Set `RELAYER_URL=` (empty)
   - Backend will fail gracefully
   - Users see "Service temporarily unavailable"

---

## Next Steps

1. Deploy backend to Railway
2. Deploy relayer to Railway  
3. Configure internal networking
4. Fund relayer wallet with devnet SOL
5. Test payment flow
6. Monitor for 24 hours
7. Switch frontend to production domain

---

## Support

Check these files for more details:
- `ARCHITECTURE_OOM_FIX.md` - Technical architecture
- `OOM_REFACTOR_COMPLETE.md` - Refactor summary
- Logs in Railway dashboard → Service logs
