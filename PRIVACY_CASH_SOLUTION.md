# Privacy Cash Integration - FINAL SOLUTION 🎯

## ✅ CONFIRMED BY PRIVACY CASH TEAM

Direct clarification from Zhe (Privacy Cash core developer):

> **Deposit is ALWAYS client-signed**  
> Client signs the deposit, relayer signs the withdrawal  
> For deposit users sign it, so funds can't be taken out of user wallet without user approval

**This is the correct architecture by design.**

---

## 🔍 SDK SOURCE CODE ANALYSIS

### How Deposit Actually Works

**File: [privacy-cash-sdk/src/index.ts](privacy-cash-sdk/src/index.ts#L103-L107)**
```typescript
async deposit({ lamports }) {
    let res = await deposit({
        transactionSigner: async (tx: VersionedTransaction) => {
            tx.sign([this.keypair])  // ✅ USER'S keypair signs!
            return tx
        },
        // ...
    })
}
```

**File: [privacy-cash-sdk/src/deposit.ts](privacy-cash-sdk/src/deposit.ts#L406)**
```typescript
// Build transaction
let versionedTransaction = new VersionedTransaction(messageV0);

// ✅ USER SIGNS HERE (via transactionSigner callback)
versionedTransaction = await transactionSigner(versionedTransaction)

logger.debug('Transaction signed by user');

// Serialize signed transaction
const serializedTransaction = Buffer.from(versionedTransaction.serialize()).toString('base64');

// Submit to relayer backend (just for relay, NOT signing)
const signature = await relayDepositToIndexer(serializedTransaction, signer, referrer);
```

**Key insight:**
- `transactionSigner` is a CALLBACK function
- SDK passes unsigned transaction to this callback
- Callback signs with user's wallet
- SDK submits pre-signed transaction to relayer
- **Relayer only submits to Solana, does NOT sign**

---

## ❌ THE ONLY PROBLEM: Browser Compatibility

### Circuit File Loading (Node.js Only)

**File: [privacy-cash-sdk/src/utils/prover.ts](privacy-cash-sdk/src/utils/prover.ts#L83-L84)**
```typescript
return await groth16Typed.fullProve(
    utilsTyped.stringifyBigInts(input),
    `${keyBasePath}.wasm`,  // ❌ Filesystem path
    `${keyBasePath}.zkey`,  // ❌ Filesystem path
    // ...
)
```

**File: [privacy-cash-sdk/src/index.ts](privacy-cash-sdk/src/index.ts#L105)**
```typescript
keyBasePath: path.join(import.meta.dirname, '..', 'circuit2', 'transaction2'),
```

**Problems:**
1. `import.meta.dirname` - Node.js 20+ only (not available in browser)
2. `path.join()` - Node.js module (polyfillable)
3. `groth16.fullProve()` expects **filesystem paths**, not URLs
4. Circuit files are 19MB (`transaction2.wasm` + `transaction2.zkey`)
5. Underlying library uses `fs.readFileSync()` internally

---

## 💡 SOLUTION: Custom Browser-Compatible SDK Wrapper

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React + Vite)                                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Custom Privacy Cash Browser Wrapper                  │ │
│  │                                                        │ │
│  │  1. Fetch circuit files from CDN/static hosting      │ │
│  │  2. Load into memory (ArrayBuffer)                   │ │
│  │  3. Call snarkjs with in-memory files                │ │
│  │  4. Build deposit transaction                        │ │
│  │  5. User signs with Phantom wallet                   │ │
│  │  6. Submit to Privacy Cash relayer                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Phantom Wallet Adapter                               │ │
│  │ - User approves transaction                          │ │
│  │ - Signs with private key (client-side)               │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ POST /deposit (signed transaction)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Privacy Cash Relayer (Official)                             │
│ - Receives pre-signed transaction                           │
│ - Submits to Solana                                         │
│ - Updates indexer                                           │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Strategy

#### Option 1: Minimal SDK Fork (RECOMMENDED)

**What to change:**
1. Replace filesystem loading with fetch()
2. Accept circuit files as ArrayBuffer
3. Make `keyBasePath` optional, accept URLs instead

**File to modify:** `privacy-cash-sdk/src/utils/prover.ts`

```typescript
// BEFORE (Node.js only):
async function prove(input: any, keyBasePath: string) {
    return await groth16Typed.fullProve(
        input,
        `${keyBasePath}.wasm`,  // filesystem path
        `${keyBasePath}.zkey`,  // filesystem path
        // ...
    )
}

// AFTER (Browser-compatible):
async function prove(input: any, options: {
    keyBasePath?: string,
    wasmUrl?: string,
    zkeyUrl?: string,
    wasmBuffer?: ArrayBuffer,
    zkeyBuffer?: ArrayBuffer
}) {
    let wasmData, zkeyData;
    
    if (options.wasmBuffer && options.zkeyBuffer) {
        // Use pre-loaded buffers (browser)
        wasmData = options.wasmBuffer;
        zkeyData = options.zkeyBuffer;
    } else if (options.wasmUrl && options.zkeyUrl) {
        // Fetch from URL (browser)
        wasmData = await fetch(options.wasmUrl).then(r => r.arrayBuffer());
        zkeyData = await fetch(options.zkeyUrl).then(r => r.arrayBuffer());
    } else if (options.keyBasePath) {
        // Use filesystem (Node.js)
        wasmData = `${options.keyBasePath}.wasm`;
        zkeyData = `${options.keyBasePath}.zkey`;
    } else {
        throw new Error('Must provide either keyBasePath, URLs, or Buffers');
    }
    
    return await groth16Typed.fullProve(input, wasmData, zkeyData, ...);
}
```

**Required changes:**
- [ ] Fork `privacy-cash-sdk` to your repo
- [ ] Modify `src/utils/prover.ts` to accept URLs or Buffers
- [ ] Update `src/index.ts` to pass browser-compatible options
- [ ] Test with circuit files hosted on CDN
- [ ] Publish as `@shadowpay/privacy-cash-browser`

#### Option 2: Separate Browser Wrapper (EASIER, NO FORK)

Create a new package that wraps the SDK functionality:

```typescript
// src/lib/privacyCashBrowser.ts

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { prove } from './prover'; // Our modified prover
import { buildDepositInstruction } from './deposit'; // Extract logic from SDK

export class PrivacyCashBrowser {
    private wasmBuffer?: ArrayBuffer;
    private zkeyBuffer?: ArrayBuffer;
    
    async loadCircuits() {
        // Load once and cache
        if (!this.wasmBuffer) {
            this.wasmBuffer = await fetch('/circuits/transaction2.wasm')
                .then(r => r.arrayBuffer());
        }
        if (!this.zkeyBuffer) {
            this.zkeyBuffer = await fetch('/circuits/transaction2.zkey')
                .then(r => r.arrayBuffer());
        }
    }
    
    async deposit({ 
        lamports, 
        walletAdapter 
    }: {
        lamports: number,
        walletAdapter: any // Phantom adapter
    }) {
        await this.loadCircuits();
        
        // Build deposit transaction (extract logic from SDK)
        const unsignedTx = await this.buildDepositTransaction({
            lamports,
            publicKey: walletAdapter.publicKey
        });
        
        // User signs with Phantom
        const signedTx = await walletAdapter.signTransaction(unsignedTx);
        
        // Submit to Privacy Cash relayer
        const signature = await this.submitToRelayer(signedTx);
        
        return { signature };
    }
    
    private async buildDepositTransaction(params) {
        // Core logic extracted from SDK deposit.ts
        // Uses this.wasmBuffer and this.zkeyBuffer instead of filesystem
        // ...
    }
    
    private async submitToRelayer(signedTx: VersionedTransaction) {
        const serialized = Buffer.from(signedTx.serialize()).toString('base64');
        
        const response = await fetch('https://relayer.privacycash.com/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signedTransaction: serialized })
        });
        
        const { signature } = await response.json();
        return signature;
    }
}
```

**Usage in PayLink.tsx:**

```typescript
import { PrivacyCashBrowser } from '@/lib/privacyCashBrowser';
import { useWallet } from '@solana/wallet-adapter-react';

const { publicKey, signTransaction } = useWallet();

const privacyCash = new PrivacyCashBrowser();
await privacyCash.loadCircuits(); // Preload (show loading bar)

// When user clicks "Pay"
const { signature } = await privacyCash.deposit({
    lamports: 10000,
    walletAdapter: { publicKey, signTransaction }
});
```

---

## 📦 Circuit File Hosting

### Where to Host Circuit Files

**Option A: Vercel Static Assets**
```
public/
  circuits/
    transaction2.wasm  (3.1 MB)
    transaction2.zkey  (16 MB)
```

Pros:
- ✅ Same domain (no CORS)
- ✅ Fast CDN
- ✅ Simple deployment

Cons:
- ⚠️ 19MB in your repo
- ⚠️ Increases deployment size

**Option B: Separate CDN (AWS S3 / Cloudflare R2)**
```
https://circuits.shadowpay.xyz/
  transaction2.wasm
  transaction2.zkey
```

Pros:
- ✅ Keeps repo small
- ✅ Can cache aggressively
- ✅ Separate versioning

Cons:
- ⚠️ Need CORS configuration
- ⚠️ Extra infrastructure

**Option C: Privacy Cash Official CDN**
Ask Privacy Cash team if they host circuit files publicly:
```
https://cdn.privacycash.com/circuits/
  transaction2.wasm
  transaction2.zkey
```

Pros:
- ✅ Official source
- ✅ Always up-to-date
- ✅ No hosting needed

**RECOMMENDED: Option A for MVP, Option C long-term**

---

## 🚀 Implementation Plan

### Phase 1: Proof of Concept (2-3 hours)

1. **Extract circuit files from SDK**
   ```bash
   cp privacy-cash-sdk/circuit2/transaction2.wasm public/circuits/
   cp privacy-cash-sdk/circuit2/transaction2.zkey public/circuits/
   ```

2. **Create minimal wrapper**
   ```typescript
   // src/lib/privacyCashBrowser.ts
   // Implement just deposit() with hardcoded circuit loading
   ```

3. **Test in PayLink.tsx**
   ```typescript
   import { PrivacyCashBrowser } from '@/lib/privacyCashBrowser';
   // Replace existing Privacy Cash SDK usage
   ```

### Phase 2: Production-Ready (1-2 days)

1. **Fork Privacy Cash SDK**
   - Clone to `@shadowpay/privacy-cash-browser`
   - Modify `prover.ts` to accept URLs
   - Add browser build configuration
   - Publish to npm

2. **Add Loading UI**
   - Progress bar for circuit download
   - Cache circuits in IndexedDB
   - Show "Loading ZK circuits..." on first use

3. **Error Handling**
   - Retry logic for circuit download
   - Fallback to different CDN
   - User-friendly error messages

### Phase 3: Optimization (Optional)

1. **Circuit Preloading**
   - Download circuits on page load
   - Store in IndexedDB
   - Skip download on repeat visits

2. **Lazy Loading**
   - Only load circuits when "Pay with Privacy Cash" clicked
   - Show loading state

3. **Service Worker Caching**
   - Cache circuits for offline use
   - Automatic updates

---

## 📝 Code Examples

### Complete Browser Implementation

```typescript
// src/lib/privacyCashBrowser.ts

import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

const CIRCUIT_CDN = 'https://your-cdn.com/circuits'; // or use /circuits/ for same-origin

export class PrivacyCashBrowser {
    private connection: Connection;
    private wasmBuffer?: ArrayBuffer;
    private zkeyBuffer?: ArrayBuffer;
    private loading = false;
    
    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }
    
    /**
     * Preload circuit files (19MB total)
     * Call this early to improve UX
     */
    async loadCircuits(onProgress?: (progress: number) => void) {
        if (this.wasmBuffer && this.zkeyBuffer) {
            return; // Already loaded
        }
        
        if (this.loading) {
            throw new Error('Circuits already loading');
        }
        
        this.loading = true;
        
        try {
            // Try IndexedDB cache first
            const cached = await this.getCachedCircuits();
            if (cached) {
                this.wasmBuffer = cached.wasm;
                this.zkeyBuffer = cached.zkey;
                onProgress?.(100);
                return;
            }
            
            // Download wasm (3.1 MB)
            onProgress?.(10);
            const wasmRes = await fetch(`${CIRCUIT_CDN}/transaction2.wasm`);
            if (!wasmRes.ok) throw new Error('Failed to load wasm circuit');
            this.wasmBuffer = await wasmRes.arrayBuffer();
            onProgress?.(40);
            
            // Download zkey (16 MB)
            const zkeyRes = await fetch(`${CIRCUIT_CDN}/transaction2.zkey`);
            if (!zkeyRes.ok) throw new Error('Failed to load zkey circuit');
            this.zkeyBuffer = await zkeyRes.arrayBuffer();
            onProgress?.(80);
            
            // Cache in IndexedDB for next time
            await this.cacheCircuits(this.wasmBuffer, this.zkeyBuffer);
            onProgress?.(100);
            
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * Deposit SOL into Privacy Cash pool
     * User signs transaction with their wallet
     */
    async deposit({
        lamports,
        wallet,
        onProgress
    }: {
        lamports: number,
        wallet: WalletContextState,
        onProgress?: (message: string) => void
    }): Promise<{ signature: string }> {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error('Wallet not connected');
        }
        
        // Ensure circuits are loaded
        onProgress?.('Loading ZK circuits...');
        await this.loadCircuits();
        
        // TODO: Build deposit transaction using SDK logic
        // This requires extracting deposit.ts logic
        onProgress?.('Building transaction...');
        const unsignedTx = await this.buildDepositTx({
            lamports,
            publicKey: wallet.publicKey
        });
        
        // User signs
        onProgress?.('Waiting for wallet approval...');
        const signedTx = await wallet.signTransaction(unsignedTx);
        
        // Submit to relayer
        onProgress?.('Submitting transaction...');
        const signature = await this.submitToRelayer(signedTx);
        
        onProgress?.('Confirming...');
        await this.connection.confirmTransaction(signature, 'confirmed');
        
        return { signature };
    }
    
    private async buildDepositTx(params: any): Promise<VersionedTransaction> {
        // TODO: Extract logic from privacy-cash-sdk/src/deposit.ts
        // Key changes:
        // 1. Use this.wasmBuffer instead of filesystem path
        // 2. Use this.zkeyBuffer instead of filesystem path
        // 3. Call groth16.fullProve() with ArrayBuffers
        throw new Error('Not implemented - needs SDK logic extraction');
    }
    
    private async submitToRelayer(signedTx: VersionedTransaction): Promise<string> {
        const serialized = Buffer.from(signedTx.serialize()).toString('base64');
        
        const response = await fetch('https://relayer.privacycash.com/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signedTransaction: serialized,
                senderAddress: signedTx.signatures[0].toString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit to relayer');
        }
        
        const { signature } = await response.json();
        return signature;
    }
    
    // IndexedDB caching
    private async getCachedCircuits() { /* ... */ }
    private async cacheCircuits(wasm: ArrayBuffer, zkey: ArrayBuffer) { /* ... */ }
}
```

### Usage in PayLink.tsx

```typescript
import { PrivacyCashBrowser } from '@/lib/privacyCashBrowser';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';

export function PayLink() {
    const wallet = useWallet();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [privacyCash] = useState(() => 
        new PrivacyCashBrowser(SOLANA_RPC_URL)
    );
    
    // Preload circuits when component mounts
    useEffect(() => {
        privacyCash.loadCircuits((p) => {
            console.log(`Circuits: ${p}%`);
        }).catch(console.error);
    }, []);
    
    async function handlePrivatePayment() {
        setLoading(true);
        try {
            const { signature } = await privacyCash.deposit({
                lamports: 10000, // 0.00001 SOL
                wallet,
                onProgress: setProgress
            });
            
            console.log('Payment successful:', signature);
            alert(`Private payment sent! Tx: ${signature}`);
        } catch (error) {
            console.error('Payment failed:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }
    
    return (
        <div>
            <button onClick={handlePrivatePayment} disabled={loading || !wallet.connected}>
                {loading ? progress : 'Pay Privately with Privacy Cash'}
            </button>
        </div>
    );
}
```

---

## ✅ VERIFICATION CHECKLIST

Before deploying to production:

- [ ] Circuit files load successfully in browser
- [ ] User can approve transaction in Phantom wallet
- [ ] Transaction is signed by USER (not relayer)
- [ ] Signed transaction submits to Privacy Cash relayer
- [ ] Deposit confirms on-chain
- [ ] Privacy Cash balance increases
- [ ] No errors in console
- [ ] Works on mobile browsers
- [ ] Circuit files cached for repeat visits
- [ ] Loading states are user-friendly

---

## 🎯 NEXT STEPS

**IMMEDIATE (Right now):**
1. Copy circuit files to `public/circuits/`
2. Create `src/lib/privacyCashBrowser.ts` skeleton
3. Test circuit file loading in browser

**SHORT-TERM (This week):**
1. Extract deposit logic from SDK
2. Modify to use ArrayBuffer instead of filesystem
3. Test full deposit flow with Phantom

**LONG-TERM (This month):**
1. Contact Privacy Cash team about official browser SDK
2. Consider contributing browser support upstream
3. Optimize circuit loading and caching

---

## 📚 RESOURCES

- Privacy Cash SDK: https://github.com/xxcode2/privacy-cash-sdk
- snarkjs docs: https://github.com/iden3/snarkjs
- groth16.fullProve API: https://github.com/iden3/snarkjs#groth16-fullprove
- Phantom wallet adapter: https://github.com/solana-labs/wallet-adapter

---

**SUMMARY:**

✅ SDK already does client-signed deposits (confirmed by Privacy Cash team)  
❌ SDK cannot run in browser (filesystem dependencies)  
💡 Solution: Fork SDK or create wrapper with HTTP-based circuit loading  
🎯 Result: True non-custodial deposits in browser
