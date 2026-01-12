# Privacy Cash Integration - Quick Start

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies

```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### Step 2: Configure Environment

Copy the testnet configuration:

```bash
cp server/.env.testnet server/.env.local
```

For production, update values:

```bash
# server/.env.local
RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your-keypair-base58
PRIVACY_CASH_ENABLED=true
PRIVACY_CASH_RPC=https://api.mainnet-beta.solana.com
```

### Step 3: Start Backend (Terminal 1)

```bash
cd server
npm start
# Output: 🚀 ShadowPay Backend listening on http://localhost:3333
```

### Step 4: Start Frontend (Terminal 2)

```bash
npm run dev
# Output: ➜  Local:   http://localhost:5173/
```

### Step 5: Test Integration

```bash
cd server
node test-privacy-cash.js
```

Expected output:
```
✅ Link created successfully
✅ Deposit successful
✅ Link retrieved successfully
✅ Authentication successful
✅ Balance retrieved successfully
✅ Test suite completed successfully!
```

## 🔑 Key Concepts

### Payment Flow

```
Payer → Frontend → Backend → Privacy Cash Pool → Recipient
  ↓       ↓         ↓           ↓                   ↓
Phantom  Create    Deposit     ZK Proof         Receive
Wallet   Link      Funds       & Commit         Direct
```

### Non-Custodial Model

- **Before**: Funds in ShadowPay backend (risky)
- **After**: Funds in Privacy Cash pool contract (safe)
  
```
Link Created     ← Metadata only (no funds)
    ↓
Deposit Made     ← Funds → Privacy Cash Pool
    ↓            ← Commitment proof returned
Link Paid        ← Commitment stored in DB
    ↓
Claim Withdrawn  ← Funds → Recipient wallet
    ↓
Complete         ← Link marked withdrawn
```

## 🧪 Testing Scenarios

### Scenario 1: Create and Pay a Link

```bash
# 1. Create link
curl -X POST http://localhost:3333/links \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.1, "token": "SOL", "anyAmount": false}'

# Response: { "success": true, "link": { "id": "a1b2c3d4", ... } }

# 2. Deposit to link
curl -X POST http://localhost:3333/links/a1b2c3d4/pay \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.1, "token": "SOL"}'

# Response: { "success": true, "link": { "status": "paid", ... } }

# 3. Retrieve link
curl http://localhost:3333/links/a1b2c3d4

# Response: { "success": true, "link": { "status": "paid", ... } }
```

### Scenario 2: Authenticate and Check Balance

```bash
# 1. Login with signature
curl -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "11111111111111111111111111111112",
    "message": "Sign me",
    "signature": "..."
  }'

# Response: { "success": true, "token": "eyJ..." }

# 2. Check balance (need valid JWT)
curl http://localhost:3333/balance \
  -H "Authorization: Bearer eyJ..."

# Response: { "success": true, "balance": 1000000000, "token": "SOL" }
```

### Scenario 3: Demo vs Production Mode

**Demo Mode** (for testing without Privacy Cash):
```bash
# Set in .env
PRIVACY_CASH_ENABLED=false

# Endpoints work but use simulated deposits/withdrawals
npm start
```

**Production Mode** (with real Privacy Cash):
```bash
# Set in .env
PRIVACY_CASH_ENABLED=true
PRIVATE_KEY=actual-keypair

# Endpoints route through real Privacy Cash SDK
npm start
```

## 📊 API Response Flow

### Successful Deposit
```
POST /links/a1b2c3d4/pay
↓
Backend validates link
↓
Calls privacyCashService.depositSOL()
↓
Privacy Cash SDK deposits to pool
↓
Returns commitment proof
↓
Backend stores commitment
↓
Returns 200 + { link: { status: "paid", commitment: "..." } }
```

### Successful Withdrawal
```
POST /links/a1b2c3d4/claim
↓
Backend validates JWT
↓
Validates link is paid
↓
Calls privacyCashService.withdrawSOL()
↓
Privacy Cash SDK transfers to recipient
↓
Backend updates link status
↓
Returns 200 + { link: { status: "withdrawn" }, txHash: "..." }
```

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check dependencies
cd server && npm install

# Check env variables
echo $RPC_URL
echo $PRIVATE_KEY

# Check port 3333 is free
lsof -i :3333
```

### Frontend can't connect to backend
```bash
# Make sure backend is running on :3333
curl http://localhost:3333/health

# Check CORS_ORIGIN in .env
# Should include your frontend URL
```

### Privacy Cash deposit fails
```bash
# Check Privacy Cash is enabled
echo $PRIVACY_CASH_ENABLED

# Verify RPC connection
curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'

# Check account has SOL for gas
solana balance <account-address> -u testnet
```

### Authentication errors
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Check token hasn't expired (24h)
# Generate new token with /auth/login

# Verify signature with Phantom wallet
```

## 📚 File Structure

```
shadowpay/
├── server/
│   ├── index.js                    # Main Express server
│   ├── auth.js                     # JWT & signature verification
│   ├── privacyCashService.js       # Privacy Cash SDK wrapper ⭐
│   ├── .env.testnet               # Testnet configuration
│   ├── .env.local                 # Local override (don't commit)
│   ├── test-privacy-cash.js       # Integration tests
│   └── links.json                 # Link metadata storage
├── src/
│   ├── App.tsx                    # React app with ErrorBoundary
│   ├── pages/
│   │   ├── CreateLink.tsx         # Create new link
│   │   ├── PayLink.tsx            # Pay/deposit to link
│   │   ├── Withdraw.tsx           # Claim/withdraw funds
│   │   └── Dashboard.tsx          # View links & balance
│   └── lib/
│       ├── privacyCash.ts         # Supabase sync functions
│       └── supabaseClient.ts      # Supabase connection
└── PRIVACY_CASH_API.md            # Full API documentation ⭐
```

## 🚀 Deployment Checklist

- [ ] Backend and frontend build without errors
- [ ] All environment variables set correctly
- [ ] Private key secured (never in version control)
- [ ] JWT_SECRET set to random 32+ char string
- [ ] RPC_URL points to correct network (testnet/mainnet)
- [ ] CORS_ORIGIN matches frontend deployment domain
- [ ] Test script passes all tests
- [ ] Payment flow tested end-to-end
- [ ] Error handling verified (bad addresses, insufficient funds, etc)
- [ ] Monitoring/logging configured
- [ ] Database backups configured
- [ ] Load testing completed

## 📞 Support

For issues or questions:
1. Check [PRIVACY_CASH_API.md](./PRIVACY_CASH_API.md) for detailed API docs
2. Check [ARCHITECTURE_HARDENED.md](./ARCHITECTURE_HARDENED.md) for design docs
3. Run `node test-privacy-cash.js` to verify setup
4. Check logs: `tail -f /var/log/shadowpay.log`

## 🔗 Related Documentation

- **API Reference**: [PRIVACY_CASH_API.md](./PRIVACY_CASH_API.md)
- **Architecture**: [ARCHITECTURE_HARDENED.md](./ARCHITECTURE_HARDENED.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Features**: [FEATURES.md](./FEATURES.md)
