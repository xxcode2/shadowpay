# Privacy Cash Integration - Deployment Checklist

## ✅ Completed Tasks

### 1. Architecture Analysis
- ✅ Identified Privacy Cash SDK requires full keypair
- ✅ Determined browser wallets (Phantom) cannot provide private keys
- ✅ Designed backend-mediated privacy architecture
- ✅ Documented privacy properties and trust model

### 2. Frontend Implementation
- ✅ Created `src/lib/privacyCashAPI.ts` - API client for Privacy Cash
- ✅ Updated `src/pages/PayLink.tsx` to use new API approach
- ✅ Removed impossible client-side SDK integration
- ✅ Added commitment storage in UI state
- ✅ Build successful (no errors)

### 3. Backend Updates
- ✅ Updated `server/index.js` `/links/:id/pay` endpoint
- ✅ Added relayer service call for deposits
- ✅ Added metadata storage (tx hash, commitment, link ID)
- ✅ Added LAMPORTS_PER_SOL import

### 4. Relayer Service
- ✅ Updated `relayer/index.js` `/deposit` endpoint
- ✅ Removed MODEL B blocking code
- ✅ Implemented Privacy Cash SDK deposit flow
- ✅ Added commitment return to user
- ✅ Privacy Cash SDK already initialized

### 5. Documentation
- ✅ Created `PRIVACY_CASH_ARCHITECTURE.md`
- ✅ Documented full architecture and flow
- ✅ Added privacy analysis
- ✅ Added API documentation
- ✅ Added testing guide

## 🔧 Pending Deployment Steps

### Step 1: Environment Variables Setup

#### Frontend (.env)
```bash
VITE_API_URL=https://shadowpay-backend.up.railway.app
VITE_RELAYER_WALLET_ADDRESS=<GET_FROM_RELAYER>
VITE_RELAYER_AUTH_SECRET=<GENERATE_SECRET>
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
```

**How to get VITE_RELAYER_WALLET_ADDRESS**:
```bash
# After deploying relayer, check logs or run:
cd relayer/
cat relayer.json | jq -r '.publicKey' # or parse [first 32 bytes]
# Convert to base58: use solana-keygen pubkey relayer.json
```

#### Backend (Railway environment)
```bash
RELAYER_URL=https://shadowpay-relayer.up.railway.app
RELAYER_AUTH_SECRET=<SAME_AS_FRONTEND>
```

#### Relayer (Railway environment)
```bash
RELAYER_AUTH_SECRET=<SAME_AS_FRONTEND_AND_BACKEND>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c
RELAYER_KEYPAIR_PATH=./relayer.json
PORT=4444
NODE_ENV=production
```

### Step 2: Relayer Keypair Setup

**Option A: Generate New Keypair**
```bash
cd relayer/
solana-keygen new --outfile relayer.json --no-bip39-passphrase

# Get address
solana-keygen pubkey relayer.json

# Fund with SOL for gas (0.5-1 SOL recommended)
solana transfer <relayer-address> 1 --url mainnet-beta

# Save keypair to Railway secrets (paste entire file)
cat relayer.json
```

**Option B: Use Existing Keypair**
```bash
# If you already have a funded wallet:
cp ~/.config/solana/id.json relayer/relayer.json

# Add to Railway:
# 1. Copy relayer.json content
# 2. Add as RELAYER_KEYPAIR_BASE64 env var (base64 encoded)
# 3. Or mount as file in Railway
```

### Step 3: Generate Shared Secrets

```bash
# Generate RELAYER_AUTH_SECRET
openssl rand -hex 32

# Output example:
# 3f7a9c8b2e1d4f6a8c9b7e5d3f1a2c4b5e6d7f8a9b0c1d2e3f4a5b6c7d8e9f0

# Use this SAME value for:
# - Frontend: VITE_RELAYER_AUTH_SECRET
# - Backend: RELAYER_AUTH_SECRET
# - Relayer: RELAYER_AUTH_SECRET
```

### Step 4: Deploy Services (Order Matters!)

#### 4.1 Deploy Relayer First
```bash
cd relayer/

# Railway CLI:
railway link # Link to existing project
railway up # Deploy

# Or via GitHub:
# 1. Push relayer/ to GitHub
# 2. Railway: New Service → From GitHub
# 3. Set environment variables
# 4. Deploy

# Get relayer URL from Railway dashboard
# Example: https://shadowpay-relayer.up.railway.app
```

**Verify Relayer**:
```bash
curl https://shadowpay-relayer.up.railway.app/health

# Should return: {"status":"ok","relayer":"<public-key>"}
```

#### 4.2 Deploy Backend Second
```bash
cd server/

# Update RELAYER_URL with actual URL from Step 4.1
# Deploy via Railway

# Get backend URL
# Example: https://shadowpay-backend.up.railway.app
```

**Verify Backend**:
```bash
curl https://shadowpay-backend.up.railway.app/health

# Should return: {"status":"ok","timestamp":...}
```

#### 4.3 Deploy Frontend Last
```bash
# Update .env with actual URLs from Steps 4.1 and 4.2
npm run build

# Deploy to Vercel:
vercel --prod

# Or Railway:
railway up
```

**Verify Frontend**:
- Visit deployed URL
- Check console for errors
- Verify RELAYER_WALLET_ADDRESS is set
- Test payment link creation

### Step 5: Test End-to-End Flow

#### 5.1 Create Test Link
```bash
curl -X POST https://shadowpay-backend.up.railway.app/links \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "0.001",
    "currency": "SOL",
    "creator": "test-wallet-address"
  }'

# Save link ID from response
```

#### 5.2 Make Test Payment
1. Open link in browser: `https://your-app.vercel.app/pay/<link-id>`
2. Connect Phantom wallet (make sure on mainnet)
3. Click "Pay"
4. Sign transaction in Phantom
5. Wait for confirmation
6. Check that commitment is displayed

#### 5.3 Verify On-Chain
```bash
# Check user → relayer transfer
https://solscan.io/tx/<transfer-tx-signature>

# Check relayer → Privacy Cash deposit
https://solscan.io/tx/<deposit-tx-signature>

# Verify relayer balance decreased by gas fees
https://solscan.io/account/<relayer-address>
```

### Step 6: Monitor and Debug

#### Check Relayer Logs
```bash
# Railway dashboard → Relayer service → Logs

# Look for:
✅ "Privacy Cash client initialized for relayer"
✅ "Depositing X SOL to Privacy Cash pool..."
✅ "Deposit successful: <tx-signature>"

# Errors:
❌ "RPC error" - Check SOLANA_RPC_URL
❌ "Insufficient funds" - Fund relayer wallet
❌ "Unauthorized" - Check RELAYER_AUTH_SECRET matches
```

#### Check Backend Logs
```bash
# Railway dashboard → Backend service → Logs

# Look for:
✅ "Calling relayer service..."
✅ "Privacy Cash deposit successful!"

# Errors:
❌ "Relayer deposit failed" - Check RELAYER_URL
❌ "fetch failed" - Check relayer is running
```

#### Check Frontend Console
```javascript
// Browser devtools → Console

// Look for:
✅ "Starting Privacy Cash payment flow..."
✅ "Transfer to relayer confirmed: <sig>"
✅ "Privacy Cash deposit successful!"

// Errors:
❌ "Relayer wallet address not configured" - Set VITE_RELAYER_WALLET_ADDRESS
❌ "Phantom wallet not found" - User needs Phantom extension
❌ "User rejected request" - User cancelled in wallet
```

## 🚨 Critical Security Checks

### Before Production:

- [ ] Relayer keypair is backed up securely (offline)
- [ ] RELAYER_AUTH_SECRET is strong (32+ random chars)
- [ ] RELAYER_AUTH_SECRET matches across all services
- [ ] Relayer wallet is funded (1+ SOL for gas)
- [ ] Railway environment variables are set correctly
- [ ] .env files are NOT committed to git
- [ ] Relayer.json is NOT committed to git
- [ ] RPC URL has sufficient rate limits
- [ ] Test with small amounts first (0.001 SOL)

### Production Monitoring:

- [ ] Set up Railway alerts for relayer downtime
- [ ] Monitor relayer SOL balance (alert if < 0.1 SOL)
- [ ] Track deposit success rate
- [ ] Log failed transactions for debugging
- [ ] Monitor RPC rate limits

## 📊 Expected Costs

### Relayer Gas Fees:
- **Per Deposit**: ~0.005 SOL ($1-2 at current prices)
- **Per Withdrawal**: ~0.01 SOL (ZK proof more expensive)
- **Monthly estimate** (100 transactions): 0.75 SOL

### RPC Costs:
- **Helius**: Free tier 100k requests/day
- **QuickNode**: $9/month for 1M requests
- **Triton**: Custom pricing

### Railway Hosting:
- **Relayer**: $5-10/month (lightweight)
- **Backend**: $5-10/month
- **Total**: $10-20/month

## 🔄 Rollback Plan

If deployment fails:

### Frontend Rollback:
```bash
vercel rollback
# Or redeploy previous version
```

### Backend Rollback:
```bash
# Railway: Deployments → Previous deployment → Redeploy
```

### Relayer Rollback:
```bash
# Stop relayer service
# Return MODEL B blocking code if needed
```

## ✅ Success Criteria

Deployment is successful when:

1. [ ] Frontend builds without errors
2. [ ] Backend starts without errors
3. [ ] Relayer starts and initializes Privacy Cash SDK
4. [ ] User can create payment link
5. [ ] User can make payment via Phantom
6. [ ] Transaction confirms on-chain
7. [ ] Commitment is returned and stored
8. [ ] Link status updates to "paid"
9. [ ] No errors in browser console
10. [ ] No errors in Railway logs

## 📚 Next Steps After Deployment

### Short-term (1-2 weeks):
- [ ] Implement commitment storage (local storage)
- [ ] Add withdrawal UI
- [ ] Test full deposit → withdrawal cycle
- [ ] Add error recovery (retry failed deposits)

### Medium-term (1 month):
- [ ] Encrypted commitment backup
- [ ] Multi-relayer support
- [ ] Fixed denomination deposits
- [ ] Relayer fee mechanism

### Long-term (3 months):
- [ ] Client-side ZK proof generation (reduce relayer trust)
- [ ] Social recovery for lost commitments
- [ ] Decentralized relayer network
- [ ] USDC/USDT support via Privacy Cash SDK

## 🆘 Support Resources

- **Privacy Cash SDK**: https://www.npmjs.com/package/privacycash
- **ShadowPay Architecture**: PRIVACY_CASH_ARCHITECTURE.md
- **Railway Docs**: https://docs.railway.app
- **Solana Docs**: https://docs.solana.com
- **Phantom Docs**: https://docs.phantom.app

## 📝 Deployment Log Template

Copy this to track your deployment:

```
Date: _______________
Deployed by: _______________

Relayer:
- URL: _______________
- Keypair Address: _______________
- Funded Amount: _______________ SOL
- Status: ⬜ Success ⬜ Failed

Backend:
- URL: _______________
- Status: ⬜ Success ⬜ Failed

Frontend:
- URL: _______________
- Status: ⬜ Success ⬜ Failed

Test Transaction:
- Link ID: _______________
- Transfer TX: _______________
- Deposit TX: _______________
- Commitment: _______________
- Status: ⬜ Success ⬜ Failed

Notes:
_______________________________________________
_______________________________________________
```

---

**Ready to deploy?** Follow steps 1-6 in order. Good luck! 🚀
