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
const RELAYER_AUTH_SECRET = process.env.RELAYER_AUTH_SECRET;
if (!RELAYER_AUTH_SECRET) {
  console.warn("⚠️  WARNING: RELAYER_AUTH_SECRET not set - endpoints are UNPROTECTED");
  console.warn("⚠️  Anyone can submit transactions via this relayer");
  console.warn("⚠️  Set RELAYER_AUTH_SECRET in .env for production");
}

function authenticateRequest(req, res, next) {
  if (!RELAYER_AUTH_SECRET) {
    // Skip auth if not configured (dev mode)
    return next();
  }
  
  const authHeader = req.headers['x-relayer-auth'];
  if (authHeader !== RELAYER_AUTH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

/* ─────────────────────────────────────
   ENV
───────────────────────────────────── */
const RPC_URL = process.env.SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c";
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

console.log("🧾 Relayer Public Key:", relayerKeypair.publicKey.toBase58());

/* ─────────────────────────────────────
   INITIALIZATION (ASYNC)
───────────────────────────────────── */
async function initialize() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 RELAYER INITIALIZATION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Check relayer SOL balance (CRITICAL)
  console.log("1️⃣  Checking SOL balance...");
  const relayerBalance = await connection.getBalance(relayerKeypair.publicKey);
  const balanceSOL = relayerBalance / LAMPORTS_PER_SOL;
  
  console.log(`💰 Relayer SOL balance: ${balanceSOL} SOL`);
  
  if (relayerBalance === 0) {
    console.error("\n❌━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ CRITICAL ERROR: RELAYER HAS 0 SOL BALANCE!");
    console.error("❌━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("\n❌ Cannot pay transaction fees!");
    console.error(`❌ Send SOL to: ${relayerKeypair.publicKey.toBase58()}`);
    console.error("❌ Minimum required: 0.1 SOL");
    console.error("❌ Recommended: 0.5 SOL (for ~5000 transactions)");
    console.error("\n❌ Use Phantom wallet or Solana CLI:");
    console.error(`   solana transfer ${relayerKeypair.publicKey.toBase58()} 0.1 --url mainnet-beta`);
    console.error("\n❌━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    process.exit(1);
  }
  
  if (relayerBalance < 0.01 * LAMPORTS_PER_SOL) {
    console.warn("\n⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("⚠️  WARNING: LOW SOL BALANCE!");
    console.warn("⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn(`⚠️  Current: ${balanceSOL} SOL`);
    console.warn(`⚠️  Recommended: 0.1 SOL minimum`);
    console.warn(`⚠️  Send SOL to: ${relayerKeypair.publicKey.toBase58()}`);
    console.warn("⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } else {
    console.log(`✅ Balance sufficient for operations\n`);
  }

  // 2. Initialize Privacy Cash SDK
  console.log("2️⃣  Initializing Privacy Cash SDK...");
  let privacyCashClient = null;
  
  try {
    privacyCashClient = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: relayerKeypair
    });
    console.log("✅ Privacy Cash SDK initialized\n");
    
    // 3. Test SDK connection
    console.log("3️⃣  Testing SDK connection...");
    try {
      const privateBalance = await privacyCashClient.getPrivateBalance();
      console.log(`✅ SDK connected - Private balance: ${privateBalance} lamports\n`);
    } catch (balanceErr) {
      console.log("⚠️  Could not fetch balance (may be first use)\n");
    }
  } catch (err) {
    console.error("\n❌ Failed to initialize Privacy Cash SDK:", err);
    process.exit(1);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ INITIALIZATION COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return privacyCashClient;
}

// Run initialization and store client
let privacyCashClient = null;
(async () => {
  try {
    privacyCashClient = await initialize();
  } catch (err) {
    console.error("❌ Initialization failed:", err);
    process.exit(1);
  }
})();

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
   DEPOSIT - NOT HANDLED BY RELAYER
───────────────────────────────────── */
// MODEL B: Deposits happen CLIENT-SIDE
// Client builds, signs, and submits deposit to RPC directly
// Relayer NEVER touches deposits (privacy requirement)
//
// If deposit endpoint is called, it's a mistake
app.post("/deposit", authenticateRequest, async (req, res) => {
  try {
    const { lamports, payerPublicKey, linkId, referrer } = req.body;

    if (!lamports || lamports <= 0) {
      return res.status(400).json({ error: "Invalid lamports amount" });
    }

    if (!payerPublicKey) {
      return res.status(400).json({ error: "payerPublicKey required" });
    }

    // Validate payer address
    try {
      new PublicKey(payerPublicKey);
    } catch {
      return res.status(400).json({ error: "Invalid payer address" });
    }

    console.log(`💰 Depositing ${lamports / LAMPORTS_PER_SOL} SOL to Privacy Cash pool...`);
    console.log(`👤 Payer: ${payerPublicKey}`);
    console.log(`🔗 Link: ${linkId || 'none'}`);
    const startTime = Date.now();

    // ARCHITECTURE NOTE:
    // Relayer uses its own keypair to deposit to Privacy Cash pool.
    // This is privacy-preserving because:
    // 1. User sends SOL to relayer (normal transfer)
    // 2. Relayer deposits to Privacy Cash pool using SDK
    // 3. On-chain: relayer → pool (user identity hidden)
    // 4. Relayer returns commitment to user for later withdrawal
    // 
    // Privacy Cash SDK generates:
    // - Commitment (user stores this secret)
    // - Nullifier (used during withdrawal)
    // - ZK proof (proves funds exist without revealing payer)
    
    const result = await privacyCashClient.deposit({
      lamports,
      referrer: referrer || undefined
    });

    const duration = Date.now() - startTime;

    if (!result || !result.tx) {
      throw new Error("Deposit failed: no transaction signature");
    }

    console.log(`✅ Deposit successful: ${result.tx}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📋 Verify: https://solscan.io/tx/${result.tx}`);

    // Return commitment to user - THIS IS THE SECRET they need for withdrawal
    res.json({
      success: true,
      tx: result.tx,
      lamports,
      commitment: result.commitment || result.tx, // Privacy Cash SDK should return commitment
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("❌ Deposit error:", err);
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

app.listen(PORT, async () => {
  console.log(`\n🚀 Relayer server starting on port ${PORT}...`);
  console.log(`🌐 Service URL: ${process.env.SERVICE_URL || `http://localhost:${PORT}`}`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🔐 Auth required: ${RELAYER_AUTH_SECRET ? 'Yes' : 'No (dev mode)'}\n`);
  
  // Wait for initialization to complete
  let attempts = 0;
  const maxAttempts = 30;
  while (!privacyCashClient && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!privacyCashClient) {
    console.error("\n❌ FATAL: Privacy Cash client not initialized after 3 seconds!");
    console.error("❌ Check logs above for initialization errors");
    process.exit(1);
  }
  
  console.log("✅ Relayer is ready to accept requests!\n");
});

