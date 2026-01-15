# Privacy Cash Circuit Files

This directory contains ZK circuit files required for browser-based proof generation.

## Required Files

You need to copy these files from Privacy Cash:

1. **transaction2.wasm** - ZK circuit WASM module
2. **transaction2.zkey** - ZK proving key
3. **witness_calculator.js** - Witness generation helper

## Where to Get These Files

### Option 1: From Privacy Cash Official Website
1. Visit https://privacycash.com
2. Open browser DevTools → Network tab
3. Perform a deposit
4. Download these files from network requests:
   - `transaction2.wasm`
   - `transaction2.zkey`
   - `witness_calculator.js`

### Option 2: From Privacy Cash GitHub
If Privacy Cash has a public repo with circuits, download from there.

### Option 3: Build from Source (Advanced)
If you have the circom source:
```bash
circom transaction2.circom --wasm --sym
snarkjs groth16 setup ...
```

## File Structure

After copying, your directory should look like:

```
/public/circuit2/
  ├── transaction2.wasm         (~2-5 MB)
  ├── transaction2.zkey          (~10-50 MB)
  └── witness_calculator.js      (~100 KB)
```

## Verification

Once copied, verify files are accessible:

```bash
curl http://localhost:5173/circuit2/transaction2.wasm
curl http://localhost:5173/circuit2/transaction2.zkey
curl http://localhost:5173/circuit2/witness_calculator.js
```

All should return HTTP 200 (not 404).

## Usage in Code

The deposit flow loads these files:

```typescript
import { initHasher } from "@lightprotocol/hasher.rs";

// Load WASM
await initHasher();

// Files are fetched from:
// - /circuit2/transaction2.wasm
// - /circuit2/transaction2.zkey
// - /circuit2/witness_calculator.js
```

## Security Note

**CRITICAL**: These files must match the deployed Privacy Cash program's circuit.

Using wrong/modified circuits will result in:
- Invalid proofs rejected by the program
- Potential loss of funds
- Privacy leakage

Only use official circuits from Privacy Cash.

## Size Optimization

For production:
1. Enable Brotli compression on hosting (Vercel/Railway automatic)
2. Use CDN for circuit files
3. Cache aggressively (circuits never change)

Example Vite config:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'circuit': ['/public/circuit2/**']
        }
      }
    }
  }
});
```

## Troubleshooting

### "Failed to load WASM"
- Check file exists: `ls public/circuit2/transaction2.wasm`
- Check file size: `du -h public/circuit2/transaction2.wasm` (should be > 1 MB)
- Check MIME type: Vite should serve as `application/wasm`

### "Invalid proof"
- Wrong circuit version
- Corrupted download
- Re-download from official source

### "Out of memory"
- ZK proof generation requires ~500 MB RAM
- Close other browser tabs
- Use desktop (mobile may OOM)
