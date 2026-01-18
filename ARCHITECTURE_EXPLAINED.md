🏗️ SHADOWPAY CORRECT ARCHITECTURE

═══════════════════════════════════════════════════════════════════════════════

🎯 WHAT IS SHADOWPAY?

Non-custodial privacy payment links on Solana.

Orang bayar → deposit ke privacy pool → penerima tarik belakangan → tidak bisa dilink

═══════════════════════════════════════════════════════════════════════════════

✅ CORRECT FLOW - DEPOSITS (Confirmed by Privacy Cash Team)

1. USER CREATES PAYMENT LINK
   ├─ CreateLink.tsx
   ├─ POST /api/links
   └─ Server stores: { id, amount, token, status: "active" }

2. PAYER ACCESSES PAYMENT LINK
   ├─ Route: /pay/{link-id}
   └─ Page: PayLink.tsx

3. PAYER DEPOSITS (Non-Custodial - CLIENT-SIGNED)
   ├─ Browser initializes PrivacyCash SDK with user's public key
   ├─ SDK fetches current merkle tree state
   ├─ SDK generates ZK proof (10-30 seconds)
   │  └─ Proves: "I have X lamports" without revealing source
   ├─ SDK builds deposit transaction
   │  └─ Payer = user's wallet (fee payer)
   │  └─ Recipient = Privacy Cash on-chain program
   ├─ SDK submits directly to blockchain
   └─ Transaction: User → Privacy Cash Program
       └─ Result: UTXO in privacy pool (encrypted, owned by user)

4. BACKEND STORES METADATA (TRACKING ONLY)
   ├─ Receives: transaction signature from frontend
   ├─ Server stores: { link_id, tx_signature, status: "paid" }
   └─ Server NEVER touches funds

KEY ARCHITECTURE POINT:
User's public key = Owner of UTXO = User controls = Non-custodial = ✅ SAFE

═══════════════════════════════════════════════════════════════════════════════

⏳ FUTURE: WITHDRAWALS (Relayer-Signed)

When recipient claims the payment:

1. RECIPIENT PROVIDES WALLET
   ├─ Receive Link page
   └─ User enters: { recipient_wallet, amount }

2. SERVER/RELAYER PROCESSES
   ├─ Server verifies ownership (JWT + signature)
   ├─ Server calls relayer
   ├─ Relayer calls Privacy Cash SDK (Node.js)
   ├─ Relayer signs withdrawal (relayer = fee payer)
   └─ Transaction: Privacy Cash Pool → Recipient Wallet

KEY: Relayer signs = privacy-safe (relayer cannot see recipient identity due to ZK mixing)

═══════════════════════════════════════════════════════════════════════════════

🔒 PRIVACY GUARANTEES

PAYER ANONYMITY:
- Payer → Privacy Cash Pool (ZK proof hides identity)
- Pool → Recipient (mixed with other withdrawals)
- Result: Recipient cannot see payer address

RECIPIENT ANONYMITY:
- Payer sees payment link ID only
- Recipient withdraws later (separate transaction)
- ZK proof: Links deposit to withdrawal without linking to identities
- Result: Payer cannot see recipient address

NON-CUSTODIAL:
- No private keys stored
- No funds held by ShadowPay
- Payer signs in browser (no relayer)
- Relayer only for future withdrawal (optional)
- All funds on-chain (Privacy Cash smart contract)

═══════════════════════════════════════════════════════════════════════════════

🚫 WHAT IS WRONG (Anti-Patterns Found & Fixed)

❌ WRONG: User submits to relayer for deposit
   WHY: Violates non-custodial principle
   FIX: User signs in browser, submits directly to blockchain

❌ WRONG: Backend builds Privacy Cash transaction
   WHY: Browser cannot run Node.js code, SDK needs special setup
   FIX: Browser runs SDK with circuit files (wasm, zkey)

❌ WRONG: Manual circuit input building
   WHY: Bypasses SDK logic, causes "74 inputs" error
   FIX: Use SDK builder directly (SDK = source of truth)

❌ WRONG: Copying relayer signature flow for deposits
   WHY: Only withdrawal needs relayer, not deposits
   FIX: Deposits are fully user-signed (non-custodial)

═══════════════════════════════════════════════════════════════════════════════

✅ WHAT IS RIGHT (Now Implemented)

✓ User connects Phantom wallet
  → Wallet's public key = owner of UTXO
  
✓ SDK initializes with user's public key
  → sdk = new PrivacyCash({ owner: wallet.publicKey })
  
✓ SDK.deposit() handles everything automatically
  → Fetches merkle tree
  → Generates ZK proof
  → Builds transaction
  → Submits to blockchain
  
✓ Direct blockchain submission
  → No relayer fees for deposits
  → User pays only gas fees
  → Instant on-chain commitment
  
✓ Server stores metadata only
  → TX signature for tracking
  → No fund management
  → No private key custody
  → Audit-friendly
  
✓ Relayer optional for withdrawal (FUTURE)
  → Only when recipient needs privacy
  → Relayer cannot identify recipient (ZK mixing)

═══════════════════════════════════════════════════════════════════════════════

🔌 ARCHITECTURE COMPONENTS

Frontend (Browser):
├─ CreateLink.tsx (create payment link)
├─ PayLink.tsx (pay with Privacy Cash - CLIENT-SIGNED DEPOSIT)
│  ├─ Initialize SDK with user's public key
│  ├─ Call sdk.deposit() - SDK handles everything
│  └─ SDK submits to blockchain directly
├─ Withdraw.tsx (claim payment - future)
└─ privacyCashDeposit.ts (SDK wrapper functions)

Backend (Node.js - METADATA ONLY):
├─ server/index.js (API server)
├─ server/routes/links.js (store/retrieve payment links)
├─ server/routes/payments.js (deprecated)
├─ server/routes/privacy.js (future withdrawal routes)
├─ server/supabase.js (metadata storage)
└─ Does NOT manage funds, Does NOT hold keys

Blockchain (Solana - L1):
├─ Privacy Cash Program (on-chain smart contract)
├─ Privacy Pool (UTXO storage, encrypted)
└─ ZK Verification (proves ownership without revealing)

Relayer (Optional Future - FOR WITHDRAWALS ONLY):
├─ relayer/index.js (withdrawal processor)
├─ Privacy Cash SDK (Node.js version - ZK operations)
└─ Wallet (for withdrawal signature)

═══════════════════════════════════════════════════════════════════════════════

📊 COMPARISON: Deposits vs Withdrawals

DEPOSITS (Payer):
┌─────────────────────┐
│ User Controls       │ ✓ Payer signs
│ Fees Paid By        │ ✓ User pays fees
│ Relayer Involved    │ ✗ No
│ Non-Custodial       │ ✓ Yes
│ Privacy             │ ✓ Payer hidden
│ Speed               │ ✓ Instant
│ Location            │ ✓ Browser
└─────────────────────┘

WITHDRAWALS (Recipient):
┌─────────────────────┐
│ User Controls       │ ~ Recipient controls wallet only
│ Fees Paid By        │ ✓ Relayer pays fees
│ Relayer Involved    │ ✓ Yes (optional)
│ Non-Custodial       │ ✓ Yes (relayer = stateless)
│ Privacy             │ ✓ Recipient hidden
│ Speed               │ ⏳ Relayer dependent
│ Location            │ ✓ Backend/Relayer
└─────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

📝 KEY PRINCIPLES (DO NOT VIOLATE)

1. SDK = Source of Truth
   ├─ Do not bypass SDK logic
   ├─ Do not manually build circuit inputs
   └─ Use SDK methods directly

2. Deposits = User-Signed (Non-Custodial)
   ├─ User signs in browser
   ├─ No relayer involvement
   └─ No fund transfer to server

3. Withdrawals = Relayer-Signed (Privacy-Safe)
   ├─ Relayer signs (not user)
   ├─ User only verifies wallet ownership
   └─ ZK mixing hides recipient identity

4. Server = Metadata Only
   ├─ Store: commitment, status, timestamps
   ├─ Never: hold funds, manage keys, sign funds
   └─ Result: Audit-friendly, non-custodial

5. Patches Only I/O (Not Logic)
   ├─ SDK designed for Node.js (fs module)
   ├─ Browser needs Uint8Array for circuits
   ├─ Patch: fs → fetch, that's all
   └─ Do NOT touch ZK/Merkle/nullifier logic

═══════════════════════════════════════════════════════════════════════════════

🎓 LESSONS LEARNED

✅ What Worked:
- Privacy Cash team confirmed architecture
- SDK design is sound (handles everything)
- Browser support possible with circuit files
- ZK proofs secure even at longer latency

❌ What Failed:
- Manual circuit input building (caused errors)
- Bypassing SDK logic (lost reliability)
- Relayer deposits (violated non-custodial)
- Backend fund management (security risk)

✨ Key Insight:
Trust the SDK. It's designed by cryptography experts.
Don't try to outsmart it with custom implementations.

═══════════════════════════════════════════════════════════════════════════════
