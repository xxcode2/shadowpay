/**
 * ⚠️  DEPRECATED - DO NOT USE
 * 
 * This file was meant for backend Privacy Cash integration but violates architecture.
 * 
 * CORRECT ARCHITECTURE:
 * - User signs in browser with Phantom
 * - Browser submits signed tx to /api/links/:id/pay
 * - Server stores commitment, NOT holdings
 * - Privacy Cash SDK runs on Solana blockchain (on-chain verification)
 * 
 * WHY THIS FILE IS WRONG:
 * ❌ SDK requires node-specific libs (fs, worker_threads)
 * ❌ Cannot run ZK proof generation in server (too slow, expensive)
 * ❌ Should not manage user funds server-side
 * ✅ CORRECT: Server = metadata coordinator only
 * ✅ CORRECT: SDK = runs in browser OR on Solana blockchain
 * 
 * Kept for reference, but DO NOT USE.
 */

// STUB: If needed in future, implement via Privacy Cash Program interactions
export async function initPrivacyCashClient(opts) {
  throw new Error(
    "❌ initPrivacyCashClient is deprecated\n" +
    "Architecture: SDK runs in browser, not server\n" +
    "Server only stores metadata"
  );
}

export async function depositSOL(opts) {
  throw new Error("❌ Server should not handle deposits - user signs in browser");
}

export async function depositSPL(opts) {
  throw new Error("❌ Server should not handle SPL deposits");
}


export async function withdrawSOL(opts) {
  throw new Error("❌ Server should not handle withdrawals");
}

export async function withdrawSPL(opts) {
  throw new Error("❌ Server should not handle SPL withdrawals");
}

export async function getPrivateBalance() {
  throw new Error("❌ Use frontend API to check balance");
}

export async function getPrivateBalanceSPL(opts) {
  throw new Error("❌ Use frontend API to check SPL balance");
}

export function isClientInitialized() {
  return false;
}
