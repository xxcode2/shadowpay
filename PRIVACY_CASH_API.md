# Privacy Cash Integration Guide

## Architecture Overview

ShadowPay uses the **Privacy Cash SDK** for non-custodial, privacy-preserving payments on Solana. This guide explains how the integration works and how to use the endpoints.

### Core Principles

1. **Non-Custodial**: Funds never touch ShadowPay servers
2. **Privacy**: Deposits and withdrawals use Zero-Knowledge proofs
3. **Direct Transfers**: Recipients receive funds directly from Privacy Cash pool
4. **Commitment-Based**: Commitments prove deposits exist in Privacy Cash pool

## Environment Configuration

### Required Variables

```env
# Backend connection
RPC_URL=https://api.testnet.solana.com
PRIVATE_KEY=<base58-encoded-keypair>
JWT_SECRET=your-secret-key

# Privacy Cash settings
PRIVACY_CASH_ENABLED=true
PRIVACY_CASH_RPC=https://api.testnet.solana.com
PRIVACY_CASH_KEYPAIR=<base58-or-json-keypair>

# Token configuration
SOL_DECIMAL=9
USDC_MINT=4zMMC9srt5Ri5X14GAgZwysqjKm2D5BDMsktS4imsoJ
SPL_DECIMAL=6
```

### Demo Mode

Set `PRIVACY_CASH_ENABLED=false` to run in demo mode:
- Simulates deposits/withdrawals without actual Privacy Cash calls
- Useful for testing frontend without blockchain interaction
- Still persists metadata to links.json

## API Endpoints

### 1. Create Payment Link

**Endpoint**: `POST /links`

**Description**: Create a receive link for payment collection

**Body**:
```json
{
  "amount": 0.1,
  "token": "SOL",
  "anyAmount": false
}
```

**Response**:
```json
{
  "success": true,
  "link": {
    "id": "a1b2c3d4",
    "url": "http://localhost:5173/pay/a1b2c3d4",
    "amount": 0.1,
    "token": "SOL",
    "anyAmount": false,
    "status": "created",
    "commitment": null,
    "paid": false
  }
}
```

### 2. Deposit to Privacy Cash Pool

**Endpoint**: `POST /links/:id/pay`

**Description**: Deposit funds to Privacy Cash pool for the payment link

**Body**:
```json
{
  "amount": 0.1,
  "token": "SOL",
  "referrer": "optional-referrer-code"
}
```

**Flow**:
1. Backend calls `privacyCashService.depositSOL()` or `depositSPL()`
2. Privacy Cash SDK deposits funds to pool (returns commitment)
3. Commitment is stored in link metadata
4. Link status changes to "paid"

**Response**:
```json
{
  "success": true,
  "link": {
    "id": "a1b2c3d4",
    "status": "paid",
    "paid": true,
    "commitment": "commitment_hash_here",
    "txHash": "transaction_signature_here",
    "paidAt": 1705000000000
  },
  "result": {
    "tx": "transaction_signature",
    "commitment": "commitment_hash",
    "amount": 0.1,
    "token": "SOL",
    "timestamp": 1705000000000
  }
}
```

**Error Scenarios**:
- Link not found: 404
- Amount must be positive: 400
- Link already paid: 400
- Deposit to Privacy Cash fails: 500

### 3. Retrieve Link Metadata

**Endpoint**: `GET /links/:id`

**Description**: Get link details and payment status

**Response**:
```json
{
  "success": true,
  "link": {
    "id": "a1b2c3d4",
    "amount": 0.1,
    "token": "SOL",
    "status": "paid",
    "paid": true,
    "commitment": "commitment_hash",
    "paidAt": 1705000000000,
    "withdrawnAt": null
  }
}
```

### 4. Withdraw from Privacy Cash Pool

**Endpoint**: `POST /links/:id/claim` (Protected - requires JWT)

**Description**: Recipient claims/withdraws funds from Privacy Cash pool

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Body**:
```json
{
  "recipientWallet": "11111111111111111111111111111112"
}
```

**Flow**:
1. Verify JWT authentication
2. Validate link is paid (has commitment)
3. Call `privacyCashService.withdrawSOL()` or `withdrawSPL()`
4. Privacy Cash SDK transfers funds directly to recipient
5. Link status changes to "withdrawn"

**Response**:
```json
{
  "success": true,
  "link": {
    "id": "a1b2c3d4",
    "status": "withdrawn",
    "withdrawnAt": 1705000000001,
    "withdrawTxHash": "withdrawal_tx_hash"
  },
  "txHash": "withdrawal_tx_hash"
}
```

**Error Scenarios**:
- Link not found: 404
- Invalid JWT: 401
- Link not paid: 400
- Link already withdrawn: 400
- Invalid wallet address: 400
- Missing commitment: 500

### 5. Authentication

**Endpoint**: `POST /auth/login`

**Description**: Authenticate with Phantom wallet signature

**Body**:
```json
{
  "publicKey": "11111111111111111111111111111112",
  "message": "Sign this message to authenticate",
  "signature": "hex-encoded-signature"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "publicKey": "11111111111111111111111111111112"
}
```

### 6. Verify Token

**Endpoint**: `POST /auth/verify` (Protected)

**Description**: Verify JWT token validity

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "success": true,
  "user": {
    "address": "11111111111111111111111111111112"
  }
}
```

### 7. Check Privacy Cash Pool Balance

**Endpoint**: `GET /balance` (Protected - requires JWT)

**Description**: Check available balance in Privacy Cash pool

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Response**:
```json
{
  "success": true,
  "balance": 1000000000,
  "token": "SOL"
}
```

### 8. Owner Withdrawal - SOL

**Endpoint**: `POST /withdraw/sol` (Protected - requires JWT)

**Description**: Owner-only: Direct SOL withdrawal from Privacy Cash pool

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Body**:
```json
{
  "lamports": 1000000000,
  "recipient": "11111111111111111111111111111112"
}
```

**Response**:
```json
{
  "success": true,
  "result": { ... },
  "txHash": "withdrawal_tx_hash"
}
```

### 9. Owner Withdrawal - SPL

**Endpoint**: `POST /withdraw/spl` (Protected - requires JWT)

**Description**: Owner-only: Direct SPL token withdrawal from Privacy Cash pool

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Body**:
```json
{
  "mint": "4zMMC9srt5Ri5X14GAgZwysqjKm2D5BDMsktS4imsoJ",
  "amount": 1000000,
  "recipient": "11111111111111111111111111111112"
}
```

**Response**:
```json
{
  "success": true,
  "result": { ... },
  "txHash": "withdrawal_tx_hash"
}
```

## Payment Flow (End-to-End)

### Scenario: Payer sends 0.1 SOL to recipient via ShadowPay

```
1. Link Creator generates link
   POST /links → { id: "a1b2c3d4", amount: 0.1, token: "SOL" }

2. Payer deposits to Privacy Cash
   POST /links/a1b2c3d4/pay → { status: "paid", commitment: "..." }

3. Link Creator gets JWT
   POST /auth/login → { token: "eyJ..." }

4. Link Creator verifies JWT
   POST /auth/verify → { user: "..." }

5. Link Creator checks pool balance (optional)
   GET /balance → { balance: 1000000000 }

6. Recipient withdraws via link claim
   POST /links/a1b2c3d4/claim → { status: "withdrawn" }
   (Funds transferred directly to recipient wallet)
```

## Service Wrapper Functions

The `privacyCashService.js` module provides these functions:

### `depositSOL({ lamports, referrer })`
- Deposits SOL to Privacy Cash pool
- Returns: `{ tx, commitment, amount, timestamp }`
- Throws: Error with detailed message

### `depositSPL({ mintAddress, amount, referrer })`
- Deposits SPL tokens to Privacy Cash pool
- Returns: `{ tx, commitment, amount, timestamp }`
- Throws: Error with detailed message

### `withdrawSOL({ recipientAddress, lamports, referrer })`
- Withdraws SOL directly to recipient
- Returns: `{ tx, amount, recipient, timestamp }`
- Throws: Error with detailed message

### `withdrawSPL({ mintAddress, recipientAddress, amount, referrer })`
- Withdraws SPL tokens directly to recipient
- Returns: `{ tx, amount, recipient, timestamp }`
- Throws: Error with detailed message

### `getPrivateBalance()`
- Queries SOL balance in Privacy Cash pool
- Returns: Balance in lamports
- Throws: Error if query fails

### `getPrivateBalanceSPL({ mintAddress })`
- Queries SPL token balance in Privacy Cash pool
- Returns: Balance in smallest unit
- Throws: Error if query fails

## Testing

Run the integration test script:

```bash
cd server
node test-privacy-cash.js
```

This will:
1. Create a payment link
2. Deposit funds to Privacy Cash
3. Retrieve link metadata
4. Test authentication
5. Check pool balance
6. Verify all endpoints work correctly

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| RPC_URL or PRIVATE_KEY not set | Missing env vars | Add to .env.testnet |
| Cannot find package 'privacycash' | SDK not installed | Run `npm install` in server/ |
| Permission denied (GitHub) | Git auth issues | Use `gh auth login` |
| Link not found (404) | Invalid link ID | Check link ID spelling |
| Deposit to Privacy Cash pool failed | SDK error or low funds | Check RPC connection, verify balance |
| Invalid JWT (401) | Expired or bad token | Generate new token via /auth/login |

## Security Considerations

1. **Private Key Management**
   - Never commit PRIVATE_KEY to version control
   - Use `.env.local` for development
   - Use secure secrets management in production (AWS Secrets Manager, etc)

2. **JWT Tokens**
   - Tokens expire after 24 hours
   - Store securely on frontend
   - Always send via HTTPS in production

3. **Fund Safety**
   - Funds go to Privacy Cash pool contract, not ShadowPay backend
   - ShadowPay never has custody of user funds
   - Use Zero-Knowledge proofs for privacy

4. **Address Validation**
   - All Solana addresses are validated before use
   - Invalid addresses return 400 error

## Production Deployment

### Before Going Live

1. ✅ Set `PRIVACY_CASH_ENABLED=true` 
2. ✅ Use Mainnet RPC URL (not Testnet)
3. ✅ Generate new keypair for production
4. ✅ Use secure environment variable management
5. ✅ Test complete payment flow with real amounts
6. ✅ Set up monitoring and alerting
7. ✅ Document your Privacy Cash configuration

### Environment Variables for Production

```env
# Mainnet RPC
RPC_URL=https://api.mainnet-beta.solana.com

# Real keypair (keep secure!)
PRIVATE_KEY=your-production-keypair

# Enable Privacy Cash
PRIVACY_CASH_ENABLED=true
PRIVACY_CASH_RPC=https://api.mainnet-beta.solana.com

# JWT secret (strong random string)
JWT_SECRET=generate-with-openssl-rand-hex-32

# Frontend origin (for CORS)
FRONTEND_ORIGIN=https://shadowpay.app
CORS_ORIGIN=https://shadowpay.app
```

### Monitoring

Monitor these metrics:
- Deposit transaction success rate
- Withdrawal transaction latency
- Commitment generation time
- Authentication token usage
- Pool balance trends

## Additional Resources

- [Privacy Cash SDK Documentation](https://github.com/Privacy-Cash/privacy-cash-sdk)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [ShadowPay Architecture Guide](./ARCHITECTURE_HARDENED.md)
- [Deployment Guide](./DEPLOYMENT.md)
