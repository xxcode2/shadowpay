import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * ShadowPay Relayer Service (Minimal Version)
 * 
 * PURPOSE:
 * - Metadata storage for payment links (future)
 * - Health checks and monitoring
 * 
 * IMPORTANT ARCHITECTURAL NOTES:
 * - Privacy Cash SDK removed from backend/relayer
 * - Deposits MUST be done in frontend with user wallet
 * - Relayer only for future withdraw support
 * 
 * WHY NO PRIVACY CASH HERE:
 * - SDK requires Node.js fs module (cannot run in browser)
 * - User correction: Backend MUST NOT import Privacy Cash for deposits
 * - Current architecture: Frontend handles all Privacy Cash operations
 */

dotenv.config();

/* ─────────────────────────────────────
   SETUP
───────────────────────────────────── */
const app = express();
app.use(express.json());

const RELAYER_AUTH_SECRET = process.env.RELAYER_AUTH_SECRET;
if (!RELAYER_AUTH_SECRET) {
  console.warn("⚠️  RELAYER_AUTH_SECRET not set - endpoints unprotected");
}

function authenticateRequest(req, res, next) {
  if (!RELAYER_AUTH_SECRET) return next();
  
  const authHeader = req.headers['x-relayer-auth'];
  if (authHeader !== RELAYER_AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/* ─────────────────────────────────────
   ENV & CONNECTION
───────────────────────────────────── */
const RPC_URL = process.env.SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c";
const RELAYER_KEYPAIR_PATH = process.env.RELAYER_KEYPAIR_PATH || "./relayer.json";

const connection = new Connection(RPC_URL, "confirmed");

const secret = JSON.parse(fs.readFileSync(RELAYER_KEYPAIR_PATH, "utf8"));
const relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

console.log("🔑 Relayer:", relayerKeypair.publicKey.toBase58());

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
async function initialize() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 RELAYER INITIALIZATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const balance = await connection.getBalance(relayerKeypair.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;
  
  console.log(`💰 Balance: ${balanceSOL} SOL`);
  
  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    console.warn(`⚠️  LOW BALANCE! Send SOL to: ${relayerKeypair.publicKey.toBase58()}`);
  } else {
    console.log("✅ Balance OK\n");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ INIT COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

initialize().catch(err => {
  console.error("❌ Init failed:", err);
  process.exit(1);
});

/* ─────────────────────────────────────
   ENDPOINTS
───────────────────────────────────── */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "shadowpay-relayer",
    version: "3.0.0-minimal",
    relayer: relayerKeypair.publicKey.toBase58(),
    note: "Privacy Cash SDK removed - deposits in frontend only",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", async (req, res) => {
  try {
    const balance = await connection.getBalance(relayerKeypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    res.json({
      status: "healthy",
      relayer: relayerKeypair.publicKey.toBase58(),
      solBalance: balanceSOL,
      hasMinimumBalance: balance >= 0.01 * LAMPORTS_PER_SOL,
      rpcUrl: RPC_URL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      error: err.message
    });
  }
});

app.post("/build-deposit", (req, res) => {
  res.status(410).json({
    error: "Endpoint removed",
    reason: "Privacy Cash deposits must be in frontend with user wallet",
    migration: {
      use: "Frontend Privacy Cash SDK",
      install: "npm install privacycash",
      example: "import { PrivacyCash } from 'privacycash'; await privacyCash.deposit({ lamports })"
    }
  });
});

app.post("/withdraw", authenticateRequest, (req, res) => {
  res.status(501).json({
    error: "Not implemented",
    reason: "Withdraw support coming soon"
  });
});

/* ─────────────────────────────────────
   START
───────────────────────────────────── */
const PORT = process.env.PORT || 4445;
app.listen(PORT, () => {
  console.log(`\n✅ Relayer running on port ${PORT}`);
  console.log(`✅ Public key: ${relayerKeypair.publicKey.toBase58()}\n`);
});

