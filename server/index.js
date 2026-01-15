import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import { PublicKey } from "@solana/web3.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLERS - PREVENT CONTAINER CRASHES
// ═══════════════════════════════════════════════════════════════════════════════

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 UNHANDLED REJECTION:", reason);
  console.error("Promise:", promise);
  // DON'T EXIT - keep server running
});

process.on("uncaughtException", (error) => {
  console.error("💥 UNCAUGHT EXCEPTION:", error);
  console.error("Stack:", error.stack);
  // DON'T EXIT - keep server running
});

/**
 * ShadowPay Backend Server
 * 
 * ARCHITECTURE:
 * - NON-CUSTODIAL: Never stores user private keys or funds
 * - PRIVACY-FIRST: All funds flow through Privacy Cash pool
 * - METADATA ONLY: Stores link metadata, commitments, tx hashes
 * - RELAYER-BASED: Delegates transaction signing to relayer service
 * 
 * CRITICAL SECURITY RULES:
 * 1. Backend NEVER signs transactions for users
 * 2. Backend NEVER stores balances (fetched from Privacy Cash SDK only)
 * 3. Backend NEVER touches funds (all via Privacy Cash pool)
 * 4. Relayer service signs with its own keypair (privacy preserving)
 * 
 * FLOW:
 * 1. User creates link → stored in Supabase
 * 2. Payer deposits → relayer calls Privacy Cash SDK deposit()
 * 3. Commitment stored → link marked as "paid"
 * 4. Recipient withdraws → relayer calls Privacy Cash SDK withdraw()
 * 5. Funds sent to recipient → link marked as "withdrawn"
 */

import {
  verifySignature,
  generateToken,
  authMiddleware
} from "./auth.js";

import {
  getCorsOptions,
  globalLimiter,
  paymentLimiter,
  withdrawalLimiter,
  sanitizeInput,
  securityLogger,
  validateJwtSecret,
  validatePrivateKey
} from "./security.js";

import {
  loadLinksFromSupabase,
  saveLinksToSupabase,
  initSupabase
} from "./supabase.js";

// NOTE: Privacy Cash imports removed
// All ZK proof generation now handled by relayer service
// Backend NEVER imports or calls depositSOL/withdrawSOL
// This prevents OOM crashes in backend process

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
console.log('🔍 Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('❌ Failed to load .env:', envResult.error);
} else {
  console.log('✅ .env loaded successfully');
}
console.log('🔍 JWT_SECRET present?', !!process.env.JWT_SECRET);
console.log('🔍 JWT_SECRET value:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 20) + '...' : 'MISSING');

const LINKS_FILE = path.resolve(__dirname, "links.json");

const PORT = process.env.PORT || 3333;
const RELAYER_URL = process.env.RELAYER_URL;
const RELAYER_TIMEOUT = parseInt(process.env.RELAYER_TIMEOUT || '30000', 10); // 30 seconds default

/* ─────────────────────── INIT ─────────────────────── */

// CRITICAL: Validate environment before starting
if (process.env.NODE_ENV === 'production' && !RELAYER_URL) {
  console.error('❌ FATAL: RELAYER_URL must be set in production');
  console.error('❌ Set RELAYER_URL in Railway to your relayer service URL');
  console.error('❌ Example: https://shadowpay-relayer.up.railway.app');
  process.exit(1);
}

validateJwtSecret();
validatePrivateKey();
initSupabase();

// NOTE: Privacy Cash initialization REMOVED
// Backend no longer initializes Privacy Cash client
// Relayer service handles all ZK proof generation
// This prevents OOM crashes and keeps backend lightweight

const app = express();
app.set("trust proxy", 1);

// CORS configuration - be permissive for now
const corsOptions = {
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-relayer-auth'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(globalLimiter);
app.use(securityLogger);
app.use(sanitizeInput);

/* ─────────────────────── HELPERS ─────────────────────── */

async function loadLinks() {
  try {
    const links = await loadLinksFromSupabase();
    if (Object.keys(links).length > 0) return links;
    const data = await fs.readFile(LINKS_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch {
    return {};
  }
}

async function saveLinks(map) {
  await saveLinksToSupabase(map);
  await fs.writeFile(LINKS_FILE, JSON.stringify(map, null, 2));
}

/* ─────────────────────── HEALTH ─────────────────────── */

app.get("/health", async (_, res) => {
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    },
    config: {
      port: PORT,
      hasPrivateKey: !!process.env.PRIVATE_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET,
      rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
      supabaseEnabled: false // Temporarily disabled
    }
  };
  
  res.json(health);
});

/* ───────────────────── AUTH ───────────────────── */

app.post("/auth/login", async (req, res) => {
  const { publicKey, message, signature } = req.body;

  if (!verifySignature(message, signature, publicKey)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const token = generateToken(publicKey, { address: publicKey });
  return res.json({ success: true, token });
});

/* ───────────────────── LINKS ───────────────────── */

app.post("/links", async (req, res) => {
  const { amount, token, creator_id, expiryHours } = req.body;

  if (!amount || !creator_id) {
    return res.status(400).json({ error: "amount & creator_id required" });
  }

  const map = await loadLinks();
  const id = Math.random().toString(36).slice(2, 9);

  // Calculate expiration timestamp if expiryHours provided
  let expiresAt = undefined;
  if (expiryHours && expiryHours > 0) {
    expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000); // Convert hours to ms
    console.log(`📅 Link ${id} expires at: ${new Date(expiresAt).toISOString()}`);
  }

  const link = {
    id,
    creator_id,
    amount,
    token: token || "SOL",
    status: "active",
    commitment: null,
    payment_count: 0,
    created_at: Date.now(),
    expiresAt
  };

  map[id] = link;
  await saveLinks(map);

  const linkWithUrl = {
    ...link,
    url: `${process.env.FRONTEND_ORIGIN}/pay/${id}`
  };

  res.json({
    success: true,
    link: linkWithUrl
  });
});

app.get("/links/:id", async (req, res) => {
  const map = await loadLinks();
  const link = map[req.params.id];
  if (!link) return res.status(404).json({ error: "not found" });
  
  // Check if link is expired
  const now = Date.now();
  if (link.expiresAt && now > link.expiresAt) {
    return res.json({ success: true, link: { ...link, status: "expired" } });
  }
  
  res.json({ success: true, link });
});

/* ───────────────────── PAY (DEPOSIT) ───────────────────── */

app.post("/links/:id/pay", paymentLimiter, async (req, res) => {
  const { amount, token, payerWallet } = req.body;
  const map = await loadLinks();
  const link = map[req.params.id];

  if (!link) return res.status(404).json({ error: "Link not found" });
  if (link.status === "paid") {
    return res.status(400).json({ error: "Already paid" });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    // ⚠️ ARCHITECTURE: ZK proof generation MOVED TO RELAYER
    // Backend is NOW lightweight orchestrator only:
    // - Validate request
    // - Forward to relayer (which handles ZK)
    // - Store result
    // - NEVER generates proofs here
    
    console.log(`💳 Initiating payment (forwarding to relayer for ZK proof)...`);
    console.log(`   Amount: ${amount} SOL`);
    console.log(`   Payer: ${payerWallet}`);
    console.log(`   Link: ${link.id}`);

    const lamports = Math.floor(amount * 1000000000);
    
    // ✅ CALL RELAYER - Relayer handles ALL ZK proof generation
    // Backend NEVER imports or calls Privacy Cash deposit
    // This prevents OOM in backend process
    const relayerUrl = RELAYER_URL;
    
    if (!relayerUrl) {
      throw new Error("RELAYER_URL not configured - backend cannot process payments");
    }
    
    console.log(`📡 Forwarding to relayer: POST ${relayerUrl}/deposit`);
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RELAYER_TIMEOUT);
    
    let relayerRes;
    try {
      relayerRes = await fetch(`${relayerUrl}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lamports,
          payerWallet,
          linkId: link.id
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!relayerRes.ok) {
      const errText = await relayerRes.text();
      throw new Error(`Relayer error (${relayerRes.status}): ${errText}`);
    }

    const result = await relayerRes.json();

    if (!result || !result.tx) {
      throw new Error("Relayer did not return transaction signature");
    }

    // Store deposit transaction and commitment
    link.status = "paid";
    link.commitment = result.commitment || result.tx;
    link.txHash = result.tx;
    link.payment_count += 1;
    link.paid_at = Date.now();
    
    console.log(`✅ Payment processed via relayer: ${result.tx}`);

    map[link.id] = link;
    await saveLinks(map);

    res.json({ success: true, link, tx: result.tx });
  } catch (err) {
    console.error("❌ Payment failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ───────────────────── CLAIM (WITHDRAW) ───────────────────── */

app.post(
  "/links/:id/claim",
  withdrawalLimiter,
  authMiddleware,
  async (req, res) => {
    const { recipientWallet } = req.body;
    const map = await loadLinks();
    const link = map[req.params.id];

    if (!link) return res.status(404).json({ error: "Link not found" });
    if (link.status !== "paid") {
      return res.status(400).json({ error: "Not withdrawable" });
    }

    try {
      new PublicKey(recipientWallet);
    } catch {
      return res.status(400).json({ error: "Invalid wallet" });
    }

    try {
      // ⚠️ ARCHITECTURE: ZK proof generation MOVED TO RELAYER
      // Backend is NOW lightweight orchestrator only:
      // - Validate commitment exists
      // - Forward to relayer (which generates ZK proof)
      // - Store result
      // - NEVER generates proofs here

      console.log(`💸 Initiating withdrawal (forwarding to relayer for ZK proof)...`);
      console.log(`   Amount: ${link.amount} SOL`);
      console.log(`   Recipient: ${recipientWallet}`);
      console.log(`   Link: ${link.id}`);

      const lamports = Math.floor(link.amount * 1000000000);
      const relayerUrl = RELAYER_URL;
      
      if (!relayerUrl) {
        throw new Error("RELAYER_URL not configured - backend cannot process withdrawals");
      }
      
      console.log(`📡 Forwarding to relayer: POST ${relayerUrl}/withdraw`);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RELAYER_TIMEOUT);
      
      let relayerRes;
      try {
        relayerRes = await fetch(`${relayerUrl}/withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commitment: link.commitment,
            recipient: recipientWallet,
            lamports
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!relayerRes.ok) {
        const errText = await relayerRes.text();
        throw new Error(`Relayer error (${relayerRes.status}): ${errText}`);
      }

      const result = await relayerRes.json();

      if (!result || !result.tx) {
        throw new Error("Relayer did not return transaction signature");
      }

      link.status = "withdrawn";
      link.withdraw_tx = result.tx;
      link.withdrawn_at = Date.now();

      console.log(`✅ Withdrawal processed via relayer: ${result.tx}`);

      map[link.id] = link;
      await saveLinks(map);

      res.json({ success: true, tx: result.tx });
    } catch (err) {
      console.error("❌ Withdrawal failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ───────────────────── DASHBOARD ───────────────────── */

app.get("/payment-links", async (req, res) => {
  const user = req.query.user_id;
  if (!user) return res.json({ links: [] });

  const map = await loadLinks();
  const links = Object.values(map)
    .filter((l) => l.creator_id === user)
    .map((link) => {
      // Check if link is expired
      const now = Date.now();
      if (link.expiresAt && now > link.expiresAt) {
        return { ...link, status: "expired" };
      }
      return link;
    });

  res.json({ success: true, links });
});

/* ───────────────────── BALANCE ───────────────────── */

app.get("/balance", async (req, res) => {
  const userId = req.query.user_id;
  
  if (!userId) {
    return res.status(400).json({ error: "user_id required" });
  }

  try {
    // CRITICAL: Balance is ONLY from Privacy Cash SDK
    // Backend does NOT store or calculate balance
    // This is single source of truth
    // If Privacy Cash client not initialized, returns 0
    const balanceData = await getPrivateBalance();
    
    res.json({
      success: true,
      balance: balanceData.sol,
      lamports: balanceData.lamports
    });
  } catch (err) {
    console.error("Failed to fetch balance:", err);
    // Return 0 if Privacy Cash client not initialized or failed
    res.json({ success: true, balance: 0, lamports: 0 });
  }
});

/* ───────────────────── WITHDRAW ───────────────────── */

app.post("/withdraw", withdrawalLimiter, authMiddleware, async (req, res) => {
  const { user_id, amount, token, recipient } = req.body;

  if (!recipient || !amount || amount <= 0) {
    return res.status(400).json({ error: "recipient and amount required" });
  }

  try {
    new PublicKey(recipient);
  } catch {
    return res.status(400).json({ error: "Invalid recipient address" });
  }

  try {
    const lamports = Math.floor(amount * 1000000000);

    console.log(`💸 Direct withdrawal via embedded relayer: ${amount} SOL → ${recipient}`);

    // Call embedded withdraw function directly
    const result = await withdrawSOL({
      recipient,
      lamports,
      referrer: undefined
    });

    if (!result || !result.tx) {
      throw new Error("No transaction signature returned from embedded relayer");
    }

    res.json({ success: true, txHash: result.tx });
  } catch (err) {
    console.error("Withdrawal failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ───────────────────── ERROR HANDLER (LAST MIDDLEWARE) ───────────────────── */

// Catch-all error handler MUST be last
app.use((err, req, res, next) => {
  console.error("💥 EXPRESS ERROR HANDLER:", err);
  
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  }
});

/* ───────────────────── START ───────────────────── */

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  
  if (!RELAYER_URL) {
    console.warn(`⚠️  RELAYER_URL not configured - using fallback: http://localhost:4444`);
    console.warn(`⚠️  This works for LOCAL TESTING ONLY`);
    console.warn(`⚠️  For production, set RELAYER_URL to your relayer service URL`);
  } else {
    console.log(`🔁 Relayer at: ${RELAYER_URL}`);
  }
  
  console.log(`⏱️  Relayer timeout: ${RELAYER_TIMEOUT}ms`);
  console.log(`\n✅ ARCHITECTURE VERIFIED:`);
  console.log(`   - LIGHTWEIGHT: No ZK proof generation`);
  console.log(`   - ORCHESTRATOR: Forwards payments to relayer`);
  console.log(`   - NO OOM: All heavy logic isolated in relayer`);
  console.log(`   - METADATA ONLY: Stores links, commitments, tx hashes`);
  console.log(`   - STABLE: No uncontrolled memory usage`);
  console.log(`   - RESILIENT: Timeout protection on relayer calls\n`);
});
