/**
 * DEPOSIT WORKER LAUNCHER
 * 
 * Spawns worker thread untuk ZK deposit computation
 */

import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runDepositWorker(config) {
  return new Promise((resolve, reject) => {
    const timeout = config.timeout || 60000;
    
    // Spawn worker thread dengan file terpisah
    const worker = new Worker(join(__dirname, "depositWorker.thread.js"), {
      workerData: {
        rpcUrl: config.rpcUrl,
        relayerSecretKey: Array.from(config.relayerSecretKey),
        lamports: config.lamports,
        referrer: config.referrer
      }
    });

    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Deposit timeout after ${timeout}ms`));
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
