/**
 * DEPOSIT WORKER THREAD FILE
 * 
 * This file runs in a separate worker thread.
 * DO NOT import this directly - use depositWorker.js launcher.
 */

import { Keypair } from "@solana/web3.js";
import { PrivacyCash } from "privacycash";
import { parentPort, workerData } from "worker_threads";

(async () => {
  try {
    const { rpcUrl, relayerSecretKey, lamports, referrer } = workerData;
    
    // Reconstruct keypair dari secret key
    const relayerKeypair = Keypair.fromSecretKey(
      Uint8Array.from(relayerSecretKey)
    );
    
    // Initialize Privacy Cash client
    const privacyCashClient = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: relayerKeypair
    });
    
    console.log(`⚙️  [WORKER] Starting ZK deposit: ${lamports} lamports`);
    const startTime = Date.now();
    
    // ⚠️  CRITICAL: ZK proof generation happens HERE
    // This blocks THIS thread, but main Express thread remains responsive
    const result = await privacyCashClient.deposit({
      lamports,
      referrer: referrer || undefined
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ [WORKER] ZK deposit complete in ${duration}ms`);
    
    // Send result back to main thread
    parentPort.postMessage({
      success: true,
      result,
      duration
    });
  } catch (error) {
    console.error("❌ [WORKER] ZK deposit failed:", error);
    
    // Send error back to main thread
    parentPort.postMessage({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
})();
