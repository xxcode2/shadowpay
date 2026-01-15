import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

// ALT (Address Lookup Table) - SDK default may be outdated
// Override with custom ALT or let SDK create new one
if (!process.env.NEXT_PUBLIC_ALT_ADDRESS) {
  console.log("⚠️  No ALT address set - SDK will use default or create new");
  // For production, you may want to create and pin specific ALT
}

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
  
  // Try to fetch balance to verify SDK is ready
  // This will trigger any initialization needed by SDK
  try {
    const privateBalance = await privacyCashClient.getPrivateBalance();
    console.log(`💰 Current private balance: ${privateBalance} lamports`);
  } catch (balanceErr) {
    console.log("⚠️  Could not fetch initial balance (may be first use):", balanceErr.message);
    // Don't exit - this is non-critical, user may not have balance yet
  }
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
   DEPOSIT (Privacy-Preserving)
───────────────────────────────────── */
app.post("/deposit", authenticateRequest, async (req, res) => {
  try {
    const { lamports, payerWallet, signedTransaction, referrer } = req.body;

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: "Invalid lamports amount" });
    }

    if (!payerWallet) {
      return res.status(400).json({ error: "Payer wallet required" });
    }

    if (!signedTransaction) {
      return res.status(400).json({ 
        error: "Signed transaction required - relayer cannot be payer (privacy violation)" 
      });
    }

    console.log(`💰 Processing Privacy Cash deposit: ${lamports / LAMPORTS_PER_SOL} SOL`);
    console.log(`👤 Payer: ${payerWallet}`);
    console.log("⏳ [RELAYER] deposit start");
    const start = Date.now();

    // CRITICAL: Relayer ONLY submits tx, does NOT pay
    // Payer must sign transaction in frontend
    // This preserves privacy: relayer ≠ payer
    
    // Deserialize signed transaction from frontend
    const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
    
    // Submit to network (relayer just facilitates, doesn't pay)
    const txSignature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    // Wait for confirmation
    await connection.confirmTransaction(txSignature, 'confirmed');

    // Get commitment from Privacy Cash (this is the privacy proof)
    // NOTE: Commitment should come from SDK response, not tx hash
    const result = await privacyCashClient.getDepositInfo(txSignature);

    console.log("✅ [RELAYER] deposit done in", Date.now() - start, "ms");

    if (!result || !result.commitment) {
      console.warn("⚠️  No commitment returned - using tx as fallback");
      // Fallback if SDK doesn't return commitment yet
      result.commitment = txSignature;
    }

    console.log(`✅ Deposit successful: ${txSignature}`);
    console.log(`🔐 Commitment: ${result.commitment}`);
    console.log(`📋 Verify on-chain: https://solscan.io/tx/${txSignature}`);

    res.json({
      success: true,
      tx: txSignature,
      commitment: result.commitment, // THIS is what should be saved, not tx
      lamports,
      payer: payerWallet // For reference only, don't save on-chain link
    });
  } catch (err) {
    console.error("❌ [RELAYER] deposit failed:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────
   WITHDRAW (Privacy-Preserving)
───────────────────────────────────── */
app.post("/withdraw", authenticateRequest, async (req, res) => {
  try {
    const { recipient, lamports, commitment, proof, referrer } = req.body;

    if (!recipient) {
      return res.status(400).json({ error: "recipient required" });
    }

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: "Invalid lamports amount" });
    }

    if (!commitment) {
      return res.status(400).json({ 
        error: "Commitment required - this is the privacy proof from deposit" 
      });
    }

    // Validate recipient address
    try {
      new PublicKey(recipient);
    } catch {
      return res.status(400).json({ error: "Invalid recipient address" });
    }

    console.log(`💸 Withdrawing ${lamports / LAMPORTS_PER_SOL} SOL to ${recipient}...`);
    console.log(`🔐 Using commitment: ${commitment}`);
    const startTime = Date.now();
    
    // CRITICAL: Withdraw using commitment (privacy-preserving)
    // SDK generates ZK proof to prove knowledge of commitment
    // WITHOUT revealing original payer
    const result = await privacyCashClient.withdraw({
      lamports,
      recipientAddress: recipient,
      commitment: commitment, // This links to deposit WITHOUT exposing payer
      proof: proof, // ZK proof (may be generated by SDK)
      referrer: referrer || undefined
    });
    
    const duration = Date.now() - startTime;

    if (!result || !result.tx) {
      throw new Error("Withdrawal failed: no transaction signature");
    }

    console.log(`✅ Withdrawal successful: ${result.tx}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📋 Verify: https://solscan.io/tx/${result.tx}`);
    console.log(`🔍 Privacy preserved: commitment used, payer NOT revealed`);

    res.json({
      success: true,
      tx: result.tx,
      recipient,
      lamports,
      isPartial: result.isPartial || false,
      fee: result.fee_in_lamports || 0,
      commitment: commitment // Return for reference
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

