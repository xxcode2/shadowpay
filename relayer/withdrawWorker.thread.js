/**
 * ⚠️  DEPRECATED - DO NOT USE
 * 
 * CORRECT ARCHITECTURE:
 * - Withdrawals COULD use relayer (for privacy: recipient doesn't sign)
 * - But current implementation is incomplete
 * 
 * This file kept for reference, but NOT USED.
 */

import { parentPort } from "worker_threads";

// Immediately fail if called
setTimeout(() => {
  parentPort.postMessage({
    success: false,
    error: "❌ Withdraw worker is deprecated. Use proper relayer signature flow instead."
  });
}, 0);
