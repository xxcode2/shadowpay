/**
 * WITHDRAW WORKER THREAD FILE
 * 
 * This file runs in a separate worker thread.
 * DO NOT import this directly - use withdrawWorker.js launcher.
 */

import { Keypair } from "@solana/web3.js";
import { PrivacyCash } from "privacycash";
import { parentPort, workerData } from "worker_threads";

(async () => {
  try {
    const { rpcUrl, relayerSecretKey, lamports, recipientAddress, referrer } = workerData;
    
    // Reconstruct keypair dari secret key
    const relayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(relayerSecretKey)
    );
    
    // Initialize Privacy Cash client
    const privacyCashClient = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: relayerKeypair
    });
    
    console.log(`⚙️  [WORKER] Starting ZK withdraw: ${lamports} lamports to ${recipientAddress}`);
    const startTime = Date.now();
    
    // ⚠️  CRITICAL: ZK proof generation happens HERE
    // This is HEAVY CPU computation and blocks THIS thread
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
