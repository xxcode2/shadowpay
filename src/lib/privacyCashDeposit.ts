/**
 * Privacy Cash SDK Integration
 * 
 * Official Privacy Cash SDK wrapper for browser environment.
 * SDK handles: ZK proofs, Merkle trees, nullifiers, UTXO encryption.
 * 
 * IMPORTANT: SDK designed for Node.js, browser support via polyfills.
 * See src/polyfills.ts and vite.config.ts for compatibility layer.
 */

import { 
  Connection, 
  PublicKey,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { PrivacyCash } from "privacycash";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Official Privacy Cash Program ID (mainnet-beta)
export const PRIVACY_CASH_PROGRAM_ID = new PublicKey(
  "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD"
);

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DepositResult {
  txSignature: string;
  success: boolean;
}

export interface WithdrawResult {
  txSignature: string;
  success: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY CASH SDK INSTANCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let privacyCashInstance: PrivacyCash | null = null;

/**
 * Initialize Privacy Cash SDK instance
 * 
 * @param rpcUrl - Solana RPC URL (must be mainnet for Privacy Cash)
 * @param walletAdapter - Phantom wallet adapter (publicKey + signTransaction)
 * @param enableDebug - Enable SDK debug logging
 * 
 * @returns Initialized PrivacyCash instance
 */
export async function initializePrivacyCash(
  rpcUrl: string,
  walletAdapter: any, // Phantom wallet adapter interface
  enableDebug: boolean = true
): Promise<PrivacyCash> {
  console.log("🔐 Initializing Privacy Cash SDK...");
  console.log("   RPC:", rpcUrl);
  console.log("   Wallet:", walletAdapter.publicKey);
  
  // SDK accepts wallet adapter, not raw keypair
  privacyCashInstance = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: walletAdapter,
    enableDebug,
  });
  
  console.log("✅ Privacy Cash SDK initialized");
  return privacyCashInstance;
}

/**
 * Get or create Privacy Cash SDK instance
 */
export function getPrivacyCashInstance(): PrivacyCash {
  if (!privacyCashInstance) {
    throw new Error("Privacy Cash SDK not initialized. Call initializePrivacyCash first.");
  }
  return privacyCashInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPOSIT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Deposit SOL using Privacy Cash SDK
 * CORRECTED: User signs TX in browser, backend only forwards
 * 
 * Architecture Flow:
 * 1. Browser: Build & sign TX with Privacy Cash SDK (user = fee payer)
 * 2. Browser: Send signed TX to backend via API
 * 3. Backend: Forward signed TX to relayer
 * 4. Relayer: Submit pre-signed TX to Solana blockchain
 * 
 * @param amountLamports - Amount to deposit in lamports
 * @param privacyCash - Privacy Cash SDK instance (with user wallet)
 * @param linkId - Optional payment link ID
 * 
 * @returns DepositResult with tx signature
 */
export async function depositSOL({
  amountLamports,
  privacyCash,
  linkId,
}: {
  amountLamports: number;
  privacyCash: PrivacyCash;
  linkId?: string;
}): Promise<DepositResult> {
  console.log("💰 Starting Privacy Cash deposit (BROWSER SIGNING)...");
  console.log("   Amount:", amountLamports / LAMPORTS_PER_SOL, "SOL");
  console.log("   Mode: User signs in browser");

  try {
    console.log("\n🔐 Step 1: Building & signing TX with Privacy Cash SDK...");
    console.log("   ⏳ SDK will:");
    console.log("      1. Generate ZK proof in browser");
    console.log("      2. Build transaction (user = fee payer)");
    console.log("      3. Sign with user wallet (Phantom)");
    console.log("   This may take 10-30 seconds...");

    // SDK builds and signs transaction
    // User wallet is fee payer (has private key)
    const result = await privacyCash.deposit({
      lamports: amountLamports,
    });

    console.log("   ✅ Transaction built & signed by user!");
    console.log("   TX:", result.tx);

    // Import submitSignedDeposit dynamically to avoid circular deps
    const { submitSignedDeposit } = await import('./privacyCashClientSigned');

    console.log("\n📤 Step 2: Submitting signed TX via backend...");
    
    // Submit pre-signed transaction to backend
    const submitResult = await submitSignedDeposit({
      signedTransaction: result.tx, // This is the signed TX from SDK
      linkId,
    });

    console.log("\n🎉 DEPOSIT COMPLETE!");
    console.log("   ✅ TX signed by user (fee paid from user wallet)");
    console.log("   ✅ TX submitted via backend/relayer");
    console.log("   ✅ Signature:", submitResult.txSignature);
    console.log("   ✅ UTXO encrypted and stored by SDK");

    return {
      txSignature: submitResult.txSignature,
      success: true,
    };
  } catch (error) {
    console.error("\n❌ DEPOSIT FAILED:", error);
    console.error("   Check: User wallet must have SOL for fees");
    throw error;
  }
}

/**
 * Deposit USDC using Privacy Cash SDK
 * 
 * @param amountBaseUnits - Amount in USDC base units (1 USDC = 1000000 base units)
 * @param privacyCash - Privacy Cash SDK instance
 * 
 * @returns DepositResult with tx signature
 */
export async function depositUSDC({
  amountBaseUnits,
  privacyCash,
}: {
  amountBaseUnits: number;
  privacyCash: PrivacyCash;
}): Promise<DepositResult> {
  console.log("💰 Starting Privacy Cash USDC deposit (SDK)...");
  console.log("   Amount:", amountBaseUnits / 1000000, "USDC");

  try {
    const result = await privacyCash.depositUSDC({
      base_units: amountBaseUnits,
    });

    console.log("\n🎉 USDC DEPOSIT COMPLETE!");
    console.log("   TX:", result.tx);

    return {
      txSignature: result.tx,
      success: true,
    };
  } catch (error) {
    console.error("\n❌ USDC DEPOSIT FAILED:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Withdraw SOL using Privacy Cash SDK
 * 
 * @param amountLamports - Amount to withdraw in lamports
 * @param recipientAddress - Recipient's Solana address
 * @param privacyCash - Privacy Cash SDK instance
 * @param referrer - Optional referrer address
 * 
 * @returns WithdrawResult with tx signature
 */
export async function withdrawSOL({
  amountLamports,
  recipientAddress,
  privacyCash,
  referrer,
}: {
  amountLamports: number;
  recipientAddress: string;
  privacyCash: PrivacyCash;
  referrer?: string;
}): Promise<WithdrawResult> {
  console.log("💸 Starting Privacy Cash withdrawal (SDK)...");
  console.log("   Amount:", amountLamports / LAMPORTS_PER_SOL, "SOL");
  console.log("   Recipient:", recipientAddress);

  try {
    console.log("\n🔐 Calling Privacy Cash SDK withdraw()...");
    console.log("   ⏳ SDK will generate ZK proof for withdrawal...");

    const result = await privacyCash.withdraw({
      lamports: amountLamports,
      recipientAddress,
      referrer,
    });

    console.log("\n🎉 WITHDRAWAL COMPLETE!");
    console.log("   TX:", result.tx);
    console.log("   ✅ ZK proof verified on-chain");
    console.log("   ✅ Funds sent to recipient");

    return {
      txSignature: result.tx,
      success: true,
    };
  } catch (error) {
    console.error("\n❌ WITHDRAWAL FAILED:", error);
    throw error;
  }
}

/**
 * Withdraw USDC using Privacy Cash SDK
 */
export async function withdrawUSDC({
  amountBaseUnits,
  recipientAddress,
  privacyCash,
  referrer,
}: {
  amountBaseUnits: number;
  recipientAddress: string;
  privacyCash: PrivacyCash;
  referrer?: string;
}): Promise<WithdrawResult> {
  console.log("💸 Starting Privacy Cash USDC withdrawal (SDK)...");
  console.log("   Amount:", amountBaseUnits / 1000000, "USDC");

  try {
    const result = await privacyCash.withdrawUSDC({
      base_units: amountBaseUnits,
      recipientAddress,
      referrer,
    });

    return {
      txSignature: result.tx,
      success: true,
    };
  } catch (error) {
    console.error("\n❌ USDC WITHDRAWAL FAILED:", error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE & UTXO MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get private balance from Privacy Cash SDK
 * SDK automatically syncs and decrypts UTXOs
 */
export async function getPrivateBalance(
  privacyCash: PrivacyCash
): Promise<{ sol: number; usdc: number }> {
  console.log("📊 Fetching private balance from Privacy Cash...");
  
  try {
    const balance = await privacyCash.getPrivateBalance();
    
    // SDK returns { lamports: number } for SOL
    // Convert to SOL and add USDC (default to 0)
    const solBalance = balance.lamports / LAMPORTS_PER_SOL;
    const usdcBalance = 0; // SDK doesn't return USDC yet
    
    console.log("✅ Private balance:");
    console.log("   SOL:", solBalance);
    console.log("   USDC:", usdcBalance);
    
    return {
      sol: solBalance,
      usdc: usdcBalance,
    };
  } catch (error) {
    console.error("❌ Failed to fetch balance:", error);
    throw error;
  }
}

/**
 * Clear UTXO cache
 * SDK automatically caches downloaded UTXOs for performance
 */
export async function clearUTXOCache(privacyCash: PrivacyCash): Promise<void> {
  console.log("🗑️  Clearing Privacy Cash UTXO cache...");
  
  await privacyCash.clearCache();
  
  console.log("✅ UTXO cache cleared");
}

/**
 * Clear all stored UTXOs (for testing only)
 */
export function clearAllStoredData(): void {
  window.localStorage.removeItem('privacycash_utxos');
  window.localStorage.removeItem('privacycash_cache');
  console.log("✅ Cleared all Privacy Cash data");
}
export { depositSOL as depositWithSignature } from './privacyCashDeposit';
