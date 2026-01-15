/**
 * WITHDRAW WORKER LAUNCHER
 * 
 * Spawns worker thread untuk ZK withdraw computation
 */

import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runWithdrawWorker(config) {
  return new Promise((resolve, reject) => {
    const timeout = config.timeout || 120000;
    
    // Spawn worker thread dengan file terpisah
    const worker = new Worker(join(__dirname, "withdrawWorker.thread.js"), {
      workerData: {
        rpcUrl: config.rpcUrl,
        relayerSecretKey: Array.from(config.relayerSecretKey),
        lamports: config.lamports,
        recipientAddress: config.recipientAddress,
        referrer: config.referrer
      }
    });

    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Withdraw timeout after ${timeout}ms`));
    }, timeout);

    worker.on("message", (message) => {
      clearTimeout(timeoutId);
      worker.terminate();
      
      if (message.success) {
        resolve(message.result);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on("error", (error) => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(error);
    });

    worker.on("exit", (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
