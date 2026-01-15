import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PrivacyCash } from "privacycash";

/**
 * ShadowPay Relayer Service
 * 
 * PURPOSE:
 * - Signs and submits Privacy Cash transactions
 * - Pays gas fees for users (privacy preserving)
 * - Breaks on-chain link between payer and receiver
 * 
 * SECURITY:
 * - Uses its OWN keypair (not user keys)
 * - NEVER stores user data
 * - NEVER knows user balances
 * - Only submits transactions to Privacy Cash protocol
 * 
 * REQUIREMENTS:
 * - Must have SOL balance for gas fees
 * - Must have access to relayer.json keypair
 * - Must have Privacy Cash SDK installed
 */

dotenv.config();

/* ─────────────────────────────────────
   BASIC SETUP
───────────────────────────────────── */
const app = express();
app.use(express.json());

// CRITICAL SECURITY: Add authentication middleware
// TODO: Implement HMAC authentication between backend ↔ relayer
// Current risk: Anyone can call relayer endpoints (DOS vector)
const RELAYER_SECRET = process.env.RELAYER_SECRET;
if (!RELAYER_SECRET) {
  console.warn("⚠️  WARNING: RELAYER_SECRET not set - endpoints are UNPROTECTED");
  console.warn("⚠️  Anyone can submit transactions via this relayer");
  console.warn("⚠️  Set RELAYER_SECRET in .env for production");
}

function authenticateRequest(req, res, next) {
  if (!RELAYER_SECRET) {
    // Skip auth if not configured (dev mode)
    return next();
  }
  
  const authHeader = req.headers['x-relayer-auth'];
  if (authHeader !== RELAYER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

/* ─────────────────────────────────────
   ENV
───────────────────────────────────── */
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RELAYER_KEYPAIR_PATH = process.env.RELAYER_KEYPAIR_PATH || "./relayer.json";

/* ─────────────────────────────────────
   SOLANA CONNECTION
───────────────────────────────────── */
const connection = new Connection(RPC_URL, "confirmed");

/* ─────────────────────────────────────
   RELAYER KEYPAIR
───────────────────────────────────── */
const secret = JSON.parse(fs.readFileSync(RELAYER_KEYPAIR_PATH, "utf8"));
const relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(secret));

console.log("🧾 Relayer:", relayerKeypair.publicKey.toBase58());

/* ─────────────────────────────────────
   PRIVACY CASH CLIENT
───────────────────────────────────── */
// CRITICAL: Relayer uses Privacy Cash SDK to:
// 1. Deposit funds to Privacy Cash pool (on-chain)
// 2. Withdraw funds from Privacy Cash pool (on-chain)
// 3. Sign transactions with its own keypair (privacy preserving)
// 4. NEVER store user keys or balances
let privacyCashClient = null;

try {
  privacyCashClient = new PrivacyCash({
    RPC_url: RPC_URL,
    owner: relayerKeypair
  });
  console.log("✅ Privacy Cash client initialized for relayer");
} catch (err) {
  console.error("❌ Failed to initialize Privacy Cash client:", err);
  process.exit(1);
}

/* ─────────────────────────────────────
   HEALTH
───────────────────────────────────── */
app.get("/health", async (_, res) => {
  try {
    const balance = await connection.getBalance(relayerKeypair.publicKey);
    res.json({
      ok: true,
      relayer: relayerKeypair.publicKey.toBase58(),
      balance: balance / LAMPORTS_PER_SOL,
      rpcUrl: RPC_URL
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      relayer: relayerKeypair.publicKey.toBase58()
    });
  }
});

/* ─────────────────────────────────────
   DEPOSIT
───────────────────────────────────── */
app.post("/deposit", authenticateRequest, async (req, res) => {
  try {
    const { lamports, payerWallet, referrer } = req.body;

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: "Invalid lamports amount" });
    }

    console.log(`💰 Depositing ${lamports / LAMPORTS_PER_SOL} SOL to Privacy Cash...`);

    // CRITICAL: This calls Privacy Cash SDK which should:
    // 1. Create on-chain transaction to Privacy Cash program
    // 2. Generate cryptographic commitment
    // 3. Store commitment in on-chain Merkle tree
    // Runtime verification needed: inspect tx on Solscan
    console.log("⏳ [RELAYER] deposit start");
    const start = Date.now();

    const result = await privacyCashClient.deposit({
      lamports,
      referrer: referrer || undefined
    });

    console.log("✅ [RELAYER] deposit done in", Date.now() - start, "ms");

    if (!result || !result.tx) {
      throw new Error("Deposit failed: no transaction signature");
    }

    console.log(`✅ Deposit successful: ${result.tx}`);
    console.log(`📋 Verify on-chain: https://solscan.io/tx/${result.tx}`);
    console.log(`🔍 Check: Does tx call Privacy Cash program (not SystemProgram)?`);

    res.json({
      success: true,
      tx: result.tx,
      commitment: result.tx, // Transaction hash serves as commitment reference
      lamports
    });
  } catch (err) {
    console.error("❌ [RELAYER] deposit failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────
   WITHDRAW
───────────────────────────────────── */
app.post("/withdraw", authenticateRequest, async (req, res) => {
  try {
    const { recipient, lamports, referrer } = req.body;

    if (!recipient) {
      return res.status(400).json({ error: "recipient required" });
    }

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: "Invalid lamports amount" });
    }

    // Validate recipient address
    try {
      new PublicKey(recipient);
    } catch {
      return res.status(400).json({ error: "Invalid recipient address" });
    }

    console.log(`💸 Withdrawing ${lamports / LAMPORTS_PER_SOL} SOL to ${recipient}...`);

    // CRITICAL: This should trigger ZK proof generation
    // Expected behavior:
    // 1. Generate ZK proof of commitment knowledge
    // 2. Prove commitment exists in Merkle tree
    // 3. Submit proof to Privacy Cash program
    // 4. Program verifies proof and sends SOL to recipient
    // 
    // ⚠️  VERIFICATION NEEDED:
    // - Does this take 1-3 seconds (proof generation)?
    // - Does transaction contain proof data?
    // - Is nullifier enforced to prevent double-spend?
    const startTime = Date.now();
    
    const result = await privacyCashClient.withdraw({
      lamports,
      recipientAddress: recipient,
      referrer: referrer || undefined
    });
    
    const duration = Date.now() - startTime;

    if (!result || !result.tx) {
      throw new Error("Withdrawal failed: no transaction signature");
    }

    console.log(`✅ Withdrawal successful: ${result.tx}`);
    console.log(`⏱️  Duration: ${duration}ms ${duration > 1000 ? '(ZK proof likely)' : '(instant - NO ZK?)'}`); 
    console.log(`📋 Verify on-chain: https://solscan.io/tx/${result.tx}`);
    console.log(`🔍 Check: Does tx contain proof data? Is nullifier present?`);

    res.json({
      success: true,
      tx: result.tx,
      recipient,
      lamports,
      isPartial: result.isPartial || false,
      fee: result.fee_in_lamports || 0
    });
  } catch (err) {
    console.error("❌ Withdrawal error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────
   START
───────────────────────────────────── */
const PORT = process.env.PORT || 4444;

// CRITICAL: Validate environment in production
const NODE_ENV = process.env.NODE_ENV || 'development';
if (NODE_ENV === 'production' && !process.env.PORT) {
  console.error('❌ FATAL: PORT environment variable must be set in production');
  console.error('❌ Set PORT in Railway variables to expose relayer service');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 Relayer running on port ${PORT}`);
  console.log(`🌐 Service URL: ${process.env.SERVICE_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🔐 Auth required: ${RELAYER_SECRET ? 'Yes' : 'No (dev mode)'}`);
});

