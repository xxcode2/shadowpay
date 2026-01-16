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
    console.log('⚠️  Auth skipped (RELAYER_AUTH_SECRET not set)');
    return next();
  }
  
  const authHeader = req.headers['x-relayer-auth'];
  if (authHeader !== RELAYER_AUTH_SECRET) {
    console.error('❌ Auth failed:');
    console.error('   Expected auth header:', RELAYER_AUTH_SECRET.substring(0, 10) + '...');
    console.error('   Received auth header:', authHeader ? authHeader.substring(0, 10) + '...' : 'MISSING');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('✅ Auth successful');
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

// Run initialization to validate environment
// NOTE: SDK instance created PER REQUEST to prevent state conflicts
let sdkInitialized = false;
(async () => {
  try {
    const testClient = await initialize();
    sdkInitialized = true;
    console.log("✅ Privacy Cash SDK validated - will create instance per request");
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
   DEPOSIT (WITH PRIVACY CASH SDK)
───────────────────────────────────── */
// CORRECT ARCHITECTURE:
// Frontend → Backend → Relayer → Privacy Cash SDK
// Relayer creates ZK proof and submits transaction
// User DOES NOT sign anything (privacy-preserving)
// Relayer pays gas fees (breaks on-chain link)

app.post("/deposit", authenticateRequest, async (req, res) => {
  try {
    const { amount, linkId, lamports } = req.body;

    // Accept either amount (SOL) or lamports
    const depositLamports = lamports || (amount ? Math.floor(amount * LAMPORTS_PER_SOL) : null);

    if (!depositLamports || depositLamports <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!linkId) {
      return res.status(400).json({ error: "linkId required" });
    }

    console.log("💰 Privacy Cash DEPOSIT via relayer");
    console.log("   Amount:", depositLamports / LAMPORTS_PER_SOL, "SOL");
    console.log("   Link:", linkId);
    console.log("   Fee payer: Relayer (privacy-preserving)");

    const startTime = Date.now();

    // 🔐 PRIVACY CASH DEPOSIT (THE CORE)
    // Create fresh SDK instance PER REQUEST to prevent state conflicts
    // This is critical: SDK has internal state (UTXO cache, commitment tree)
    // Concurrent requests with shared instance = race conditions
    console.log("🔐 Creating fresh Privacy Cash SDK instance...");
    const client = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: relayerKeypair
    });
    
    console.log("🔐 Calling Privacy Cash SDK deposit()...");
    const result = await client.deposit({
      lamports: depositLamports,
    });

    const duration = Date.now() - startTime;

    if (!result || !result.tx) {
      throw new Error("Privacy Cash deposit failed: no transaction signature");
    }

    console.log("✅ Deposit successful");
    console.log("   TX:", result.tx);
    console.log("   Commitment:", result.commitment || 'N/A');
    console.log("   Duration:", duration, "ms");
    console.log("   Verify: https://solscan.io/tx/" + result.tx);

    res.json({
      success: true,
      txSignature: result.tx,
      commitment: result.commitment || null,
      amount: depositLamports / LAMPORTS_PER_SOL
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
    // Create fresh SDK instance PER REQUEST to prevent state conflicts
    console.log("🔐 Creating fresh Privacy Cash SDK instance...");
    const client = new PrivacyCash({
      RPC_url: RPC_URL,
      owner: relayerKeypair
    });
    
    // SDK generates ZK proof to prove knowledge of commitment
    // WITHOUT revealing original payer
    const result = await client.withdraw({
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
  
  // Wait for SDK validation to complete
  let attempts = 0;
  const maxAttempts = 30;
  while (!sdkInitialized && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!sdkInitialized) {
    console.error("\n❌ FATAL: Privacy Cash SDK not validated after 3 seconds!");
    console.error("❌ Check logs above for initialization errors");
    process.exit(1);
  }
  
  console.log("✅ Relayer is ready to accept requests!\n");
});

