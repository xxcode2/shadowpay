/**
 * ⚠️  DEPRECATED - DO NOT USE
 * 
 * CORRECT ARCHITECTURE:
 * - User signs deposit in browser
 * - No relayer needed for deposits
 * - User submits directly to blockchain
 * 
 * This file kept for reference, but NOT USED.
 */

import { parentPort } from "worker_threads";

// Immediately fail if called
setTimeout(() => {
  parentPort.postMessage({
    success: false,
    error: "❌ Deposit worker is deprecated. Use browser-based signing instead.",
    architecture: "User → Sign in browser → Submit to blockchain directly"
  });
}, 0);
