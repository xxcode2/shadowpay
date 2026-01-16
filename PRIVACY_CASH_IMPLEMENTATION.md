# Privacy Cash Integration - Implementation Status

## ✅ COMPLETED

### 1. Understanding & Architecture
- [x] Confirmed with Privacy Cash team: **Deposits ARE client-signed**
- [x] Analyzed SDK source code to understand internal flow
- [x] Identified root cause: Circuit files require Node.js fs module
- [x] Documented correct architecture in [PRIVACY_CASH_SOLUTION.md](PRIVACY_CASH_SOLUTION.md)

### 2. Relayer Cleanup
- [x] Removed ALL Privacy Cash SDK imports from [relayer/index.js](relayer/index.js)
- [x] Cleaned [relayer/package.json](relayer/package.json) (removed 113 packages)
- [x] Tested relayer starts successfully
- [x] Committed changes and pushed to GitHub
- [x] Railway deployment should now work ✅

### 3. Circuit Files Setup
- [x] Created [public/circuits/](public/circuits/) directory
- [x] Copied circuit files from SDK:
  - `transaction2.wasm` (3.1 MB)
  - `transaction2.zkey` (16 MB)
- [x] Updated [.gitignore](.gitignore) to exclude circuit files from git

## 🚧 TODO: Browser-Compatible Implementation

### Next Steps (Priority Order)

#### PHASE 1: Proof of Concept (2-3 hours)

**Goal:** Get Privacy Cash deposit working in browser

1. **Create browser wrapper skeleton**
   ```bash
   # File to create:
   touch src/lib/privacyCashBrowser.ts
   ```
   
   Initial implementation:
   - Load circuit files from `/circuits/` via fetch()
   - Cache in memory (later: IndexedDB)
   - Expose `deposit()` method that accepts Phantom wallet

2. **Extract core deposit logic from SDK**
   ```bash
   # Reference files:
   privacy-cash-sdk/src/deposit.ts
   privacy-cash-sdk/src/utils/prover.ts
   ```
   
   Key functions to extract:
   - Transaction building
   - ZK proof generation
   - UTXO management
   - Merkle tree operations

3. **Modify prover to use ArrayBuffer**
   ```typescript
   // Instead of:
   groth16.fullProve(input, 'file.wasm', 'file.zkey')
   
   // Use:
   groth16.fullProve(input, wasmBuffer, zkeyBuffer)
   ```

4. **Test in [src/pages/PayLink.tsx](src/pages/PayLink.tsx)**
   - Replace current broken import
   - Connect to Phantom wallet
   - Call `privacyCash.deposit({ lamports: 10000 })`
   - Verify user signs transaction
   - Check transaction appears on Solscan

#### PHASE 2: Production Polish (1-2 days)

1. **Add loading states**
   - Circuit download progress bar
   - "Loading ZK circuits..." message
   - Transaction submission feedback

2. **Implement IndexedDB caching**
   - Cache circuits after first download
   - Skip download on repeat visits
   - Clear cache when SDK version changes

3. **Error handling**
   - Retry failed circuit downloads
   - User-friendly error messages
   - Fallback to different CDN if needed

4. **Testing**
   - Test on mobile browsers
   - Test with slow connections
   - Test cache persistence
   - Test transaction confirmation

#### PHASE 3: Long-term Optimization (Optional)

1. **Circuit preloading**
   - Start downloading circuits on page load
   - Don't block UI
   - Show subtle progress indicator

2. **Service Worker**
   - Cache circuits for offline use
   - Background updates
   - Version management

3. **Upstream contribution**
   - Contact Privacy Cash team
   - Offer to contribute browser support
   - Get official CDN for circuits

---

## 📁 File Structure

```
shadowpay/
├── public/
│   └── circuits/
│       ├── transaction2.wasm  (3.1 MB) ✅ Copied
│       └── transaction2.zkey  (16 MB)  ✅ Copied
├── src/
│   ├── lib/
│   │   └── privacyCashBrowser.ts  ⏳ TODO: Create
│   └── pages/
│       └── PayLink.tsx  ⏳ TODO: Update
├── relayer/
│   ├── index.js  ✅ Cleaned (no Privacy Cash)
│   └── package.json  ✅ Cleaned
├── PRIVACY_CASH_SOLUTION.md  ✅ Complete documentation
└── PRIVACY_CASH_IMPLEMENTATION.md  📄 This file
```

---

## 🔧 Implementation Guide

### Step 1: Create Browser Wrapper

Create [src/lib/privacyCashBrowser.ts](src/lib/privacyCashBrowser.ts):

```typescript
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';

const CIRCUIT_BASE_URL = '/circuits'; // Same-origin for dev

export class PrivacyCashBrowser {
    private connection: Connection;
    private wasmBuffer?: ArrayBuffer;
    private zkeyBuffer?: ArrayBuffer;
    
    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
    }
    
    /**
     * Load circuit files from /circuits/
     * Call this early to improve UX
     */
    async loadCircuits(onProgress?: (percent: number) => void): Promise<void> {
        if (this.wasmBuffer && this.zkeyBuffer) {
            onProgress?.(100);
            return;
        }
        
        // Load wasm (3.1 MB)
        onProgress?.(10);
        const wasmRes = await fetch(`${CIRCUIT_BASE_URL}/transaction2.wasm`);
        if (!wasmRes.ok) throw new Error('Failed to load wasm circuit');
        this.wasmBuffer = await wasmRes.arrayBuffer();
        onProgress?.(40);
        
        // Load zkey (16 MB)
        const zkeyRes = await fetch(`${CIRCUIT_BASE_URL}/transaction2.zkey`);
        if (!zkeyRes.ok) throw new Error('Failed to load zkey circuit');
        this.zkeyBuffer = await zkeyRes.arrayBuffer();
        onProgress?.(100);
    }
    
    /**
     * Deposit SOL into Privacy Cash pool
     */
    async deposit({
        lamports,
        wallet,
        onProgress
    }: {
        lamports: number;
        wallet: WalletContextState;
        onProgress?: (message: string) => void;
    }): Promise<{ signature: string }> {
        if (!wallet.publicKey || !wallet.signTransaction) {
            throw new Error('Wallet not connected');
        }
        
        // Ensure circuits loaded
        onProgress?.('Loading ZK circuits...');
        await this.loadCircuits();
        
        // TODO: Build deposit transaction
        // This requires extracting logic from privacy-cash-sdk/src/deposit.ts
        onProgress?.('Building transaction...');
        throw new Error('Not implemented - needs SDK logic extraction');
    }
}
```

### Step 2: Update PayLink.tsx

Update [src/pages/PayLink.tsx](src/pages/PayLink.tsx):

```typescript
// Remove this (broken):
// import { PrivacyCash } from 'privacycash';

// Add this:
import { PrivacyCashBrowser } from '@/lib/privacyCashBrowser';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';

export function PayLink() {
    const wallet = useWallet();
    const [privacyCash] = useState(() => 
        new PrivacyCashBrowser(import.meta.env.VITE_SOLANA_RPC_URL)
    );
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    
    // Preload circuits on mount
    useEffect(() => {
        if (wallet.connected) {
            privacyCash.loadCircuits((p) => {
                console.log(`Circuits: ${p}%`);
            }).catch(console.error);
        }
    }, [wallet.connected]);
    
    async function handlePrivatePayment() {
        if (!wallet.connected) {
            alert('Connect wallet first');
            return;
        }
        
        setLoading(true);
        try {
            const { signature } = await privacyCash.deposit({
                lamports: 10000,
                wallet,
                onProgress: setProgress
            });
            
            console.log('✅ Payment successful:', signature);
            alert(`Private payment sent!\nTx: ${signature}`);
        } catch (error: any) {
            console.error('❌ Payment failed:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }
    
    return (
        <button 
            onClick={handlePrivatePayment} 
            disabled={loading || !wallet.connected}
        >
            {loading ? progress : 'Pay with Privacy Cash'}
        </button>
    );
}
```

### Step 3: Extract SDK Logic

**Key files to study:**
- `privacy-cash-sdk/src/deposit.ts` - Main deposit logic
- `privacy-cash-sdk/src/utils/prover.ts` - ZK proof generation
- `privacy-cash-sdk/src/models/utxo.ts` - UTXO model
- `privacy-cash-sdk/src/utils/merkle_tree.ts` - Merkle tree

**Critical function:**
```typescript
// privacy-cash-sdk/src/utils/prover.ts line 83
await groth16Typed.fullProve(
    input,
    `${keyBasePath}.wasm`,  // ❌ Filesystem path
    `${keyBasePath}.zkey`,  // ❌ Filesystem path
    // ...
)

// Need to change to:
await groth16Typed.fullProve(
    input,
    wasmBuffer,  // ✅ ArrayBuffer
    zkeyBuffer,  // ✅ ArrayBuffer
    // ...
)
```

**Check if snarkjs supports ArrayBuffer:**
```bash
cd privacy-cash-sdk
grep -r "fullProve" node_modules/snarkjs/
# Look for signature that accepts ArrayBuffer
```

---

## 🎯 Current Status

### What Works ✅
- Relayer is clean and deployable
- Railway deployment should succeed
- Circuit files copied to `public/circuits/`
- Architecture documented

### What's Broken ❌
- Frontend cannot use Privacy Cash SDK (fs dependency)
- [src/pages/PayLink.tsx](src/pages/PayLink.tsx) has broken import
- No browser-compatible wrapper exists yet

### What's Needed 🚧
- Extract SDK deposit logic
- Create browser-compatible wrapper
- Test with Phantom wallet
- Verify transaction signing

---

## 📞 Questions for Privacy Cash Team

Before investing time in forking/wrapper, ask:

1. **Do you have plans for browser-compatible SDK?**
   - If yes: When? Can we beta test?
   - If no: Would you accept a PR?

2. **Can circuit files be hosted on your CDN?**
   - URL like `https://circuits.privacycash.com/transaction2.wasm`
   - With CORS headers enabled
   - Versioned URLs for cache busting

3. **Does snarkjs.fullProve support ArrayBuffer input?**
   - Or does it require filesystem paths?
   - If filesystem only: Any workarounds?

4. **Are there existing browser integrations we can reference?**
   - Other projects solving this problem?
   - Example code?

---

## 🚀 Deployment Checklist

### For Railway (Relayer)
- [x] Remove Privacy Cash SDK imports
- [x] Clean package.json
- [x] Test relayer starts
- [x] Commit and push
- [ ] Verify Railway build succeeds
- [ ] Check Railway logs for errors
- [ ] Test `/health` endpoint

### For Vercel (Frontend)
- [ ] Remove broken Privacy Cash import from PayLink.tsx
- [ ] Implement browser wrapper
- [ ] Test deposit flow locally
- [ ] Test on staging domain
- [ ] Deploy to production

---

## 💡 Alternative: Quick Fix (Non-Private Payments)

If Privacy Cash proves too complex for now:

**Option:** Use regular Solana transfers temporarily
```typescript
// In PayLink.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

async function handleRegularPayment() {
    const connection = new Connection(RPC_URL);
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey!,
            toPubkey: new PublicKey(recipientAddress),
            lamports: 10000
        })
    );
    
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature);
}
```

**Pros:**
- ✅ Works immediately
- ✅ No complex setup
- ✅ Well-tested

**Cons:**
- ❌ No privacy (all on-chain)
- ❌ Defeats ShadowPay's value proposition
- ❌ Not what users signed up for

**Recommendation:** Only use as temporary fallback while building Privacy Cash integration.

---

## 📚 Resources

- [Privacy Cash SDK Source](https://github.com/xxcode2/privacy-cash-sdk)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [PRIVACY_CASH_SOLUTION.md](PRIVACY_CASH_SOLUTION.md) - Full technical docs

---

**Next Action:** Start with Phase 1 - Create `src/lib/privacyCashBrowser.ts` skeleton
