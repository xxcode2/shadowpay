/**
 * WITHDRAW WORKER THREAD
 * 
 * PURPOSE:
 * - Offload ZK proof generation for withdrawal
 * - Prevent event loop blocking
 * - Allow Express tetap responsive saat withdraw running
 * 
 * ARCHITECTURE:
 * Main Thread (Express) → spawn Worker → ZK proof generation → return result
 * 
 * WHY CRITICAL FOR WITHDRAW?
 * - Withdraw requires ZK proof of commitment knowledge
 * - Proof generation = CPU intensive (even heavier than deposit)
 * - Without worker thread → freeze → 502 timeout
 */

import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PrivacyCash } from "privacycash";

if (!isMainThread) {
  // ────────────────────────────────────
  //  WORKER THREAD EXECUTION
  // ────────────────────────────────────
  (async () => {
    try {
      const { 
        rpcUrl, 
        relayerSecretKey, 
        lamports, 
        recipientAddress,
        referrer 
      } = workerData;

      // Reconstruct keypair dari secret key
      const relayerKeypair = Keypair.fromSecretKey(
        Uint8Array.from(relayerSecretKey)
      );

      // Initialize Privacy Cash client di worker context
      const privacyCashClient = new PrivacyCash({
        RPC_url: rpcUrl,
        owner: relayerKeypair
      });

      console.log(`⚙️  [WORKER] Starting ZK withdraw: ${lamports} lamports to ${recipientAddress}`);
      const startTime = Date.now();

      // ⚠️  CRITICAL: ZK proof generation happens HERE
      // This is HEAVY CPU computation:
      // 1. Generate ZK proof of commitment knowledge
      // 2. Prove commitment exists in Merkle tree
      // 3. Create nullifier to prevent double-spend
      // This can take 3-10 seconds depending on circuit complexity
      const result = await privacyCashClient.withdraw({
        lamports,
        recipientAddress,
        referrer: referrer || undefined
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [WORKER] ZK withdraw complete in ${duration}ms`);

      // Send result back to main thread
      parentPort.postMessage({
        success: true,
        result,
        duration
      });

    } catch (error) {
      console.error("❌ [WORKER] ZK withdraw failed:", error);
      
      // Send error back to main thread
      parentPort.postMessage({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  })();
}

/**
 * Helper function untuk spawn worker dari main thread
 * 
 * @param {Object} config - Worker configuration
 * @param {string} config.rpcUrl - Solana RPC URL
 * @param {Uint8Array} config.relayerSecretKey - Relayer keypair secret
 * @param {number} config.lamports - Amount to withdraw
 * @param {string} config.recipientAddress - Recipient wallet address
 * @param {string} [config.referrer] - Optional referrer address
 * @param {number} [config.timeout=120000] - Timeout in ms (default 120s for ZK)
 * @returns {Promise<Object>} Withdraw result
 */
export async function runWithdrawWorker(config) {
  return new Promise((resolve, reject) => {
    const timeout = config.timeout || 120000; // Default 120s (ZK proof lebih lama)
    
    // Spawn worker thread
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {
        rpcUrl: config.rpcUrl,
        relayerSecretKey: Array.from(config.relayerSecretKey),
        lamports: config.lamports,
        recipientAddress: config.recipientAddress,
        referrer: config.referrer
      }
    });

    // Timeout handler (prevent infinite hang)
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Withdraw timeout after ${timeout}ms - ZK proof generation too slow`));
    }, timeout);

    // Success/Error handler
    worker.on("message", (message) => {
      clearTimeout(timeoutId);
      worker.terminate();

      if (message.success) {
        resolve(message.result);
      } else {
        reject(new Error(message.error));
      }
    });

    // Worker error handler
    worker.on("error", (error) => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(error);
    });

    // Worker exit handler (crash detection)
    worker.on("exit", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
