🔐 PRIVACY CASH SDK TECHNICAL DEEP DIVE

How Client-Signed Deposits Work in ShadowPay

═══════════════════════════════════════════════════════════════════════════════

🎯 CORE CONCEPT

The Privacy Cash SDK handles EVERYTHING for deposits:
- No manual ZK proof generation needed
- No circuit compilation needed
- No merkle tree knowledge required

You just call: `sdk.deposit({ lamports: amount })`
SDK returns: `{ tx: transactionSignature }`

═══════════════════════════════════════════════════════════════════════════════

🔬 WHAT SDK.DEPOSIT() DOES INTERNALLY

Step 1: Initialize SDK Instance
```typescript
const sdk = new PrivacyCash({
  RPC_url: "https://api.mainnet-beta.solana.com",
  owner: "user_public_key", // This is the UTXO owner
  enableDebug: true,
});
```
- SDK connects to Solana RPC
- User's public key is stored as UTXO owner
- Debug mode enabled for logging

Step 2: Fetch Current Privacy Cash Pool State
```
SDK calls RPC endpoint:
├─ Get latest merkle tree root
├─ Get current UTXO commitments
└─ Get current program state
```
This is needed to prove: "I'm adding my funds to this existing pool"

Step 3: Prepare Deposit Data
```
SDK prepares:
├─ Amount: User's deposit amount (lamports)
├─ Owner public key: User's wallet
├─ Token type: SOL or USDC
└─ Referrer: Optional (for fee sharing)
```

Step 4: Generate ZK Proof
```
SDK generates proof that proves:
✓ "I have X lamports"
✓ "I own the wallet signing this"
✓ "This proof is valid for the current merkle tree"

WITHOUT revealing:
✗ Transaction hash
✗ Exact amount details
✗ Sender identity
```

This takes 10-30 seconds (heavy computation):
- Uses snarkjs under the hood
- Runs ZK circuit with witness
- Generates proof + public signals

Step 5: Build Solana Transaction
```
SDK builds transaction:
├─ Instruction: Deposit to Privacy Cash Program
├─ Data: ZK proof + public signals
├─ Signer: User's wallet (via wallet adapter)
└─ Fee payer: User's wallet
```

Step 6: Submit to Blockchain
```
SDK submits:
├─ User MUST sign the transaction
├─ Via Phantom wallet (user approval required)
└─ SDK waits for confirmation
```

Step 7: Return Success
```typescript
return {
  tx: "3xY7...9zA" // Transaction signature
}
```

═══════════════════════════════════════════════════════════════════════════════

🔑 KEY POINT: User's Public Key = UTXO Owner

This is what makes it NON-CUSTODIAL:

Traditional Payment (NOT private):
```
User A → User B
  ↓
Blockchain shows: A sent to B
Problem: Anyone can see connection
```

Privacy Cash (WITH our implementation):
```
User A → Privacy Cash Pool (encrypted)
        ↓
       [Hidden: Amount, sender details]
        ↓
User B ← Privacy Cash Pool (later)
        ↓
       [Hidden: Which deposit this came from]

Result: A and B are NOT linkable on-chain
```

The SDK Achieves This By:
1. User signs with their private key
   - Proof that user authorized deposit
   - Proof user owns the wallet

2. ZK proof proves ownership without revealing
   - "This UTXO belongs to this user"
   - Without showing user's wallet address

3. Encrypted UTXO in pool
   - Only user can decrypt (has key)
   - Only user can spend (has proof)

═══════════════════════════════════════════════════════════════════════════════

💡 WHY NO MANUAL CIRCUIT LOGIC NEEDED

Old Approach (❌ BROKEN):
```typescript
// Try to manually build circuit inputs
const inPathElements = [...]; // Merkle proof
const inPathIndices = [...];  // Path directions
const amount = 1000000;

// Pass to circuit
const witness = await genWitness(...);
const proof = await groth16.prove(...);

// Problems:
// ✗ Hard to get merkle proof right
// ✗ Easy to get path directions wrong
// ✗ Circuit can change with SDK updates
// ✗ No validation of inputs
```

New Approach (✅ CORRECT):
```typescript
// SDK knows the circuit perfectly
// SDK validates all inputs
// SDK handles merkle proofs correctly
const result = await sdk.deposit({ lamports: 1000000 });

// SDK has done all the hard work!
```

═══════════════════════════════════════════════════════════════════════════════

🛡️ SECURITY PROPERTIES

1. Non-Custodial Deposit
   ✅ User signs with Phantom
   ✅ User's public key = UTXO owner
   ✅ ShadowPay never holds funds
   ✅ Blockchain validates all proofs

2. Privacy Guarantees
   ✅ Payer identity hidden (ZK proof)
   ✅ Amount hidden from observer (encrypted)
   ✅ Deposit/withdrawal not linkable
   ✅ Merkle mixing prevents correlation

3. Preventing Cheating
   ✅ ZK proof validates ownership
   ✅ SDK validates all circuit inputs
   ✅ Blockchain validates final transaction
   ✅ Invalid proofs get rejected

═══════════════════════════════════════════════════════════════════════════════

📊 COMPARISON: DIFFERENT DEPOSIT MODELS

Model A: Backend Deposits (❌ WRONG)
```
User → Backend → Relayer → Privacy Cash Pool
Problems:
✗ Backend controls funds
✗ Backend could steal
✗ Backend is custodial
✗ User must trust backend
```

Model B: Manual Client Deposits (❌ WRONG)
```
Frontend → Manual ZK Circuit → Blockchain
Problems:
✗ Frontend must build circuit perfectly
✗ Hard to stay in sync with SDK
✗ Easy to make cryptographic errors
✗ Not resilient to SDK changes
```

Model C: SDK Client Deposits (✅ CORRECT)
```
Frontend → SDK Deposit Function → Blockchain
Benefits:
✅ User signs = user controls
✅ SDK handles complexity
✅ Always in sync with protocol
✅ Cryptographically sound
✅ Non-custodial guaranteed
```

═══════════════════════════════════════════════════════════════════════════════

🔄 FULL FLOW IN SHADOWPAY

User opens payment link:
```
Browser
  ↓
PayLink.tsx renders
  ↓
User clicks "Pay Privately"
  ↓
handlePay() called
  ↓
Calls depositPrivateLy({
  amount: 1000000,
  wallet: phantomAdapter,
  connection: solanaConnection,
  rpcUrl: "https://api.mainnet-beta.solana.com"
})
  ↓
depositPrivateLy() initializes SDK:
  sdk = new PrivacyCash({
    owner: wallet.publicKey,
    RPC_url: rpcUrl
  })
  ↓
Calls sdk.deposit({ lamports: 1000000 })
  ↓
SDK internally:
  1. Fetches merkle tree
  2. Generates ZK proof (blocks 10-30s)
  3. Builds transaction
  4. Requests Phantom signature
  ↓
User approves in Phantom wallet
  ↓
SDK submits transaction
  ↓
SDK returns { tx: signature }
  ↓
depositPrivateLy() returns { signature, amount, timestamp }
  ↓
PayLink shows success + TX signature
  ↓
Backend stores metadata (optional):
  POST /api/links/{id}/pay { signature, amount, payer }
```

═══════════════════════════════════════════════════════════════════════════════

⚙️ RPC ENDPOINT IMPORTANCE

Why RPC Speed Matters:
```
SDK calls RPC to:
├─ Fetch merkle tree (network: ~100ms)
├─ Fetch UTXO state (network: ~100ms)
└─ Submit transaction (network: ~100ms)

Then SDK does:
├─ Generate ZK proof
│  └─ Uses fetched state
│  └─ Calculation: 10-30 seconds
│
Total time = Network time + Proof time

If RPC is slow:
├─ Slow fetch = long wait for proof start
├─ Stale data = proof might be invalid
└─ Total time could be 30-60 seconds
```

Recommendation:
- Free RPC (api.mainnet-beta.solana.com): 15-30 second proof
- Premium RPC (Helius, Magic Eden): <5 second proof
- Devnet RPC: Highly variable

═══════════════════════════════════════════════════════════════════════════════

🐛 COMMON ISSUES & SOLUTIONS

Issue: "Failed to fetch merkle tree"
Solution: Check RPC endpoint is reachable
```bash
curl https://api.mainnet-beta.solana.com -d '{"jsonrpc":"2.0", "method": "getHealth"}'
```

Issue: "ZK proof generation timeout"
Solution: Use faster RPC endpoint
```typescript
// Try premium RPC
const rpcUrl = "https://mainnet.helius-rpc.com?api-key=YOUR_KEY";
```

Issue: "Phantom signature failed"
Solution: Make sure Phantom is connected to correct network
```
- Phantom network selector
- Should match RPC (mainnet/devnet)
```

Issue: "Transaction simulation failed"
Solution: User might not have enough SOL for fees
```
Need: Amount + gas fees (~5000 lamports)
Check: Phantom shows balance?
```

═══════════════════════════════════════════════════════════════════════════════

📚 REFERENCES

SDK Repository:
- npm: privacycash@1.1.10
- GitHub: https://github.com/privacy-cash/privacy-cash

Relevant Types:
```typescript
// From privacycash package
export interface PrivacyCash {
  deposit({ lamports }): Promise<{ tx: string }>;
  getPrivateBalance(): Promise<{ lamports: number }>;
  clearCache(): Promise<void>;
}
```

Related Files in ShadowPay:
- src/lib/privacyCashDeposit.ts (wrapper functions)
- src/pages/PayLink.tsx (integration)
- ARCHITECTURE_EXPLAINED.md (full architecture)

═══════════════════════════════════════════════════════════════════════════════

✨ CONCLUSION

The Privacy Cash SDK is battle-tested and handles all the complexity.

By using `sdk.deposit()` directly, we:
✅ Get non-custodial behavior
✅ Get cryptographic security
✅ Avoid reinventing ZK proofs
✅ Stay in sync with protocol updates

This is the RECOMMENDED way to integrate Privacy Cash,
as confirmed by the Privacy Cash team themselves.

═══════════════════════════════════════════════════════════════════════════════
