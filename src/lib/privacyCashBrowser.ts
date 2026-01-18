
/**
 * ✅ CORRECT USAGE: Privacy Cash SDK for Browser
 * 
 * The PrivacyCash SDK (from npm: privacycash@1.1.10) handles everything:
 * - ZK proof generation
 * - Transaction building
 * - Direct blockchain submission
 * 
 * CORRECT FLOW:
 */

import { PrivacyCash } from "privacycash";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

/**
 * ✅ RECOMMENDED: Use the high-level depositPrivateLy() function
 * This is already implemented in src/lib/privacyCashDeposit.ts
 * 
 * See PayLink.tsx for usage example
 */

/**
 * ✅ LOW-LEVEL: Direct SDK usage (if needed)
 * 
 * Example:
 * 
 * ```typescript
 * const sdk = new PrivacyCash({
 *   RPC_url: "https://api.mainnet-beta.solana.com",
 *   owner: walletAdapter.publicKey.toBase58(), // User's public key
 *   enableDebug: true,
 * });
 * 
 * // SDK handles everything:
 * // - Fetching merkle tree
 * // - Generating ZK proof
 * // - Building transaction
 * // - Submitting to blockchain
 * const result = await sdk.deposit({
 *   lamports: 1000000, // 0.001 SOL
 * });
 * 
 * console.log("Deposit successful:", result.tx);
 * ```
 * 
 * ARCHITECTURE POINTS:
 * ✅ User's public key = owner of UTXO (non-custodial)
 * ✅ SDK generates ZK proof (proves ownership without revealing)
 * ✅ SDK builds transaction automatically
 * ✅ No manual circuit/wasm handling needed
 * ✅ Direct blockchain submission (no relayer for deposits)
 */
