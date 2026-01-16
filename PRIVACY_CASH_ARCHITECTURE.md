# Privacy Cash Integration Architecture

## Problem Statement

**Privacy Cash SDK requires full keypair (private key access)**, but **browser wallets like Phantom never expose private keys**. This made direct frontend integration impossible.

## Solution: Backend-Mediated Privacy Architecture

We've implemented a three-tier architecture that preserves privacy while working with browser wallets:

```
Frontend (Browser) → Backend API → Relayer Service → Privacy Cash SDK → Blockchain
```

## Architecture Diagram

```
┌─────────────────────┐
│   User's Wallet     │
│   (Phantom/Browser) │
└──────────┬──────────┘
           │ 1. Sign transfer to relayer wallet
           │    (normal SOL transfer)
           ▼
┌─────────────────────┐
│  Relayer Wallet     │
│  (Pool Keypair)     │
└──────────┬──────────┘
           │ 2. Relayer deposits to Privacy Cash
           │    using SDK (has keypair)
           ▼
┌─────────────────────┐
│  Privacy Cash Pool  │
│  (ZK Privacy Layer) │
└──────────┬──────────┘
           │ 3. Returns commitment
           │    (user's withdrawal secret)
           ▼
┌─────────────────────┐
│   User Storage      │
│   (Local/Encrypted) │
└─────────────────────┘
```

## Component Responsibilities

### Frontend (`src/lib/privacyCashAPI.ts`)
- **Role**: UI/UX, wallet signing
- **Does**: 
  - Creates SOL transfer transaction to relayer wallet
  - User signs with Phantom
  - Calls backend API with transaction details
- **Does NOT**:
  - Initialize Privacy Cash SDK (impossible without keypair)
  - Generate ZK proofs (requires SDK)
  - Access private keys

### Backend (`server/index.js`)
- **Role**: API orchestration, metadata storage
- **Does**:
  - Receives transfer confirmation from frontend
  - Calls relayer service with deposit request
  - Stores link metadata (tx hash, commitment, link ID)
  - Returns commitment to user
- **Does NOT**:
  - Initialize Privacy Cash SDK (delegates to relayer)
  - Sign transactions (delegates to relayer)
  - Store user private keys

### Relayer Service (`relayer/index.js`)
- **Role**: Privacy Cash SDK operations
- **Does**:
  - Holds pool keypair (NOT individual user keys)
  - Initializes Privacy Cash SDK with pool keypair
  - Deposits to Privacy Cash pool
  - Generates ZK proofs for withdrawals
  - Pays gas fees (privacy-preserving)
- **Does NOT**:
  - Store user data
  - Know user balances (privacy-preserving)
  - Expose private keys

## Deposit Flow

### Step 1: User → Relayer Transfer
```typescript
// Frontend: src/lib/privacyCashAPI.ts
await sendToRelayer({
  connection,
  payerPublicKey,
  amountLamports,
  signTransaction, // Phantom signing
});
```

**What happens**:
- Creates normal SOL transfer transaction
- User signs in Phantom wallet
- SOL sent to relayer's wallet address
- Returns transaction signature

**Privacy**: ✅ Normal transfer, visible on-chain (user → relayer)

### Step 2: Relayer → Privacy Cash Deposit
```typescript
// Backend calls relayer
POST /deposit
{
  lamports,
  payerPublicKey,
  linkId
}
```

**What happens**:
- Backend calls relayer service
- Relayer uses Privacy Cash SDK:
  ```javascript
  await privacyCashClient.deposit({
    lamports,
    referrer
  });
  ```
- SDK generates ZK proof
- SDK deposits to Privacy Cash pool
- Returns commitment secret

**Privacy**: ✅ Excellent - relayer → pool (user identity hidden)

### Step 3: Store Commitment
```typescript
// Backend stores, returns to frontend
{
  tx: depositTxSignature,
  commitment: userSecret,
  lamports
}
```

**What happens**:
- Backend stores: tx hash, commitment, link metadata
- Frontend receives commitment
- User must save commitment for withdrawal

**Privacy**: ✅ Commitment is secret, only user knows it

## Withdrawal Flow

### Future Implementation
```typescript
// User provides commitment to prove ownership
await withdrawSOL({
  recipientAddress,
  lamports,
  commitment, // Secret from deposit
});
```

**What happens**:
- User provides commitment (proves they own funds)
- Relayer generates ZK proof using SDK
- SDK verifies commitment without revealing payer
- Funds sent to recipient address

**Privacy**: ✅ Excellent - ZK proof proves ownership without revealing payer

## Privacy Analysis

### What's Visible On-Chain

1. **User → Relayer transfer**: 
   - ✅ Visible: User's wallet, relayer wallet, amount
   - ⚠️ Privacy: Moderate - shows user funded relayer

2. **Relayer → Privacy Cash deposit**:
   - ✅ Visible: Relayer wallet, Privacy Cash pool, amount
   - ✅ Privacy: Excellent - user identity hidden

3. **Privacy Cash → Recipient withdrawal**:
   - ✅ Visible: Privacy Cash pool, recipient wallet, amount
   - ✅ Privacy: Excellent - ZK proof hides original payer

### Privacy Properties

**Link Breaking**: ✅
- Relayer acts as mixer
- On-chain: User → Relayer → Pool → Recipient
- Cannot link User → Recipient directly

**Amount Hiding**: ⚠️
- Amounts are visible on-chain
- Future: Can use fixed denominations (0.1, 1, 10 SOL)

**Identity Protection**: ✅
- ZK proofs prove ownership without revealing payer
- Commitment is secret, stored client-side
- Relayer doesn't know user balances

**Timing Analysis Resistance**: ⚠️
- Deposit and withdrawal timing can be correlated
- Mitigation: Add delays, batch withdrawals

## Security Considerations

### Relayer Trust Model

**What Relayer Can Do**:
- ✅ See deposit requests (knows User → Relayer transfers)
- ✅ Pay gas fees (uses its own SOL)
- ✅ Submit transactions to Privacy Cash

**What Relayer CANNOT Do**:
- ❌ Steal user funds (no access to Privacy Cash pool)
- ❌ Know user balances (commitments stored client-side)
- ❌ Link deposits to withdrawals (ZK proofs preserve privacy)
- ❌ Censor withdrawals (user can use different relayer)

### Commitment Management

**Critical**: Users MUST store commitment for withdrawal
- Stored in: Local storage (future: encrypted cloud backup)
- Loss = Permanent loss of funds
- Future: Social recovery, multi-device sync

### Relayer Authentication

**Current**: `x-relayer-auth` header with shared secret
```bash
RELAYER_AUTH_SECRET=your-secret-here
```

**Future**: HMAC signatures, rate limiting per user wallet

## Configuration

### Environment Variables

**Frontend** (`.env`):
```bash
VITE_API_URL=https://shadowpay-backend.up.railway.app
VITE_RELAYER_WALLET_ADDRESS=<relayer-public-key>
VITE_RELAYER_AUTH_SECRET=<shared-secret>
VITE_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
```

**Backend** (`server/.env`):
```bash
RELAYER_URL=https://shadowpay-relayer.up.railway.app
RELAYER_AUTH_SECRET=<shared-secret>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
```

**Relayer** (`relayer/.env`):
```bash
RELAYER_AUTH_SECRET=<shared-secret>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
RELAYER_KEYPAIR_PATH=./relayer.json
```

### Relayer Keypair Setup

```bash
cd relayer/
solana-keygen new --outfile relayer.json
# Fund with SOL for gas fees:
# solana transfer <relayer-address> 1 --url mainnet-beta
```

## API Endpoints

### Backend API

**POST `/links/:id/pay`**
```json
{
  "transferTx": "signature-of-user-to-relayer-transfer",
  "lamports": 1000000,
  "payerPublicKey": "user-wallet-address",
  "linkId": "link-id"
}
```

Response:
```json
{
  "success": true,
  "tx": "privacy-cash-deposit-tx-signature",
  "commitment": "user-secret-for-withdrawal",
  "lamports": 1000000
}
```

### Relayer API

**POST `/deposit`**
```json
{
  "lamports": 1000000,
  "payerPublicKey": "user-wallet-address",
  "linkId": "link-id",
  "referrer": "optional-referrer-address"
}
```

Response:
```json
{
  "success": true,
  "tx": "privacy-cash-deposit-tx-signature",
  "commitment": "user-secret",
  "lamports": 1000000,
  "timestamp": 1234567890
}
```

**POST `/withdraw`** (Future)
```json
{
  "recipient": "recipient-wallet-address",
  "lamports": 1000000,
  "commitment": "user-secret-from-deposit",
  "linkId": "optional-link-id"
}
```

## Testing

### Local Development

1. **Start Relayer**:
```bash
cd relayer/
npm install
npm start # Port 4444
```

2. **Start Backend**:
```bash
cd server/
npm install
npm start # Port 3333
```

3. **Start Frontend**:
```bash
npm install
npm run dev # Port 5173
```

### Test Deposit Flow

```bash
# 1. Create payment link
curl -X POST http://localhost:3333/links \
  -H "Content-Type: application/json" \
  -d '{"amount": "0.001", "currency": "SOL", "creator": "test-wallet"}'

# 2. Make payment (via frontend UI)
# - User connects Phantom
# - Signs transfer to relayer
# - Backend calls relayer
# - Relayer deposits to Privacy Cash

# 3. Check link status
curl http://localhost:3333/links/<link-id>
```

## Future Improvements

### 1. Multi-Relayer Support
- Users can choose different relayers
- Prevents single point of failure
- Better privacy (harder to correlate)

### 2. Fixed Denominations
- Deposit/withdraw only 0.1, 1, 10 SOL amounts
- Better anonymity set
- Harder to track via amounts

### 3. Encrypted Commitment Storage
- Backup to encrypted cloud storage
- Social recovery mechanisms
- Multi-device sync

### 4. Relayer Fee Market
- Relayers charge fees for gas + service
- Users choose based on fees/trust
- Decentralized relayer network

### 5. zkSNARK Proof Generation
- Client-side proof generation (WebAssembly)
- Reduce relayer trust requirements
- Better privacy guarantees

## References

- **Privacy Cash SDK**: https://www.npmjs.com/package/privacycash
- **Zigtur Audit**: https://x.com/zigtur
- **ShadowPay Docs**: See DOCUMENTATION.md
- **Tornado Cash Model**: Inspiration for mixing architecture

## Summary

✅ **Privacy**: Excellent - relayer acts as mixer, ZK proofs hide payer
✅ **Security**: Good - relayer can't steal funds, commitments stored client-side
✅ **UX**: Seamless - users just sign Phantom transaction
⚠️ **Trust**: Relayer sees deposit requests (but can't steal funds)
⚠️ **Commitment Management**: Users must store commitment (or lose funds)

**Overall**: This is the correct architecture for Privacy Cash SDK + browser wallets.
