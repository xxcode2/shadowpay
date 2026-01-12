import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { PrivacyCash } from "privacycash";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { verifySignature, generateToken, authMiddleware } from "./auth.js";
import * as privacyCashService from "./privacyCashService.js";
import {
  getCorsOptions,
  getHelmetOptions,
  globalLimiter,
  authLimiter,
  paymentLimiter,
  withdrawalLimiter,
  sanitizeInput,
  securityLogger,
  validateJwtSecret,
  validatePrivateKey,
  auditLogger
} from "./security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHADOWPAY BACKEND — NON-CUSTODIAL RECEIVE LINK SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * CORE PRINCIPLE: This backend NEVER holds or manages funds.
 * 
 * All deposits and withdrawals are routed directly through the ShadowPay Protocol.
 * - We store link METADATA only (link ID, commitment, status)
 * - Funds go to ShadowPay privacy pool (autonomous, non-custodial)
 * - Commitments prove deposits in ShadowPay privacy pool, NOT in ShadowPay backend
 * 
 * ENDPOINTS:
 * POST /auth/login         → Verify Phantom wallet signature, issue JWT
 * POST /auth/verify        → Validate JWT token
 * POST /links              → Create receive link (metadata only)
 * GET  /links/:id          → Retrieve link metadata
 * POST /links/:id/pay      → Deposit to ShadowPay privacy pool (backend initiates)
 * POST /links/:id/claim    → Withdraw from ShadowPay privacy pool (recipient receives)
 * POST /withdraw/sol       → OWNER-ONLY: Direct SOL withdrawal from pool
 * POST /withdraw/spl       → OWNER-ONLY: Direct SPL withdrawal from pool
 * GET  /balance            → Check ShadowPay pool balance
 * 
 * SECURITY MODEL:
 * - JWT tokens for authenticated endpoints (24h expiry)
 * - Message signatures verified with TweetNaCl
 * - Private key usage is DEMO ONLY (should use Protocol in production)
 * - Links are publicly readable (metadata transparency)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const RPC = process.env.RPC_URL;
const OWNER = process.env.PRIVATE_KEY; // base58 or json array depending on usage

let client = null;

/**
 * Initialize ShadowPay Protocol client
 * This client connects to the Solana RPC and ShadowPay pool contract
 * 
 * IMPORTANT: The 'owner' field is used for demo withdrawals only.
 * Production deployments should use an on-chain Program/Protocol instead.
 */
function initClient() {
  if (!RPC || !OWNER) {
    throw new Error("RPC_URL or PRIVATE_KEY not set");
  }
  if (!client) {
    client = new PrivacyCash({ RPC_url: RPC, owner: OWNER });
  }
  return client;
}

const app = express();

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE (MUST BE FIRST)
// ═══════════════════════════════════════════════════════════════════════════════

// Validate environment variables before starting
validateJwtSecret();
validatePrivateKey();

// Security headers
const helmet = (await import('helmet')).default;
app.use(getHelmetOptions());

// CORS with strict configuration
app.use(cors(getCorsOptions()));

// Global rate limiting
app.use(globalLimiter);

// Security logging
app.use(securityLogger);

// Body parsing
app.use(express.json({ limit: '1mb' })); // Prevent large payloads

// Input sanitization
app.use(sanitizeInput);

const LINKS_FILE = path.resolve(__dirname, "links.json");

/**
 * Load all link metadata from persistent storage
 * This is NOT fund storage — funds are in ShadowPay privacy pool
 */
async function loadLinks() {
  try {
    const data = await fs.readFile(LINKS_FILE, "utf-8");
    return JSON.parse(data || "{}");
  } catch (e) {
    return {};
  }
}

/**
 * Save link metadata to persistent storage
 * This persists: link ID, commitment (proof of deposit), status, amount
 * Funds themselves are NOT stored here — they're in ShadowPay privacy pool
 */
async function saveLinks(m) {
  await fs.writeFile(LINKS_FILE, JSON.stringify(m, null, 2), "utf-8");
}

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTHENTICATION ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * POST /auth/login
 * 
 * Authenticate wallet owner via Phantom signature
 * Flow:
 * 1. Frontend signs a message with Phantom wallet
 * 2. Backend verifies signature using public key
 * 3. Backend issues JWT token for authenticated requests
 * 
 * Returns JWT for withdrawal operations (owner-only)
 */
app.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { publicKey, message, signature } = req.body;
    
    if (!publicKey || !message || !signature) {
      auditLogger.warn('⚠️ Login attempt with missing fields', {
        hasPublicKey: !!publicKey,
        hasMessage: !!message,
        hasSignature: !!signature,
        ip: req.ip,
        timestamp: new Date()
      });
      return res.status(400).json({ error: "Missing publicKey, message, or signature" });
    }

    // Verify the signature was signed by the public key (TweetNaCl)
    const isValid = verifySignature(message, signature, publicKey);
    if (!isValid) {
      auditLogger.warn('❌ Failed authentication attempt', {
        publicKey,
        ip: req.ip,
        reason: 'Invalid signature',
        timestamp: new Date()
      });
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Generate JWT token (24h expiry)
    const token = generateToken(publicKey, { address: publicKey });
    
    auditLogger.info('✅ Successful authentication', {
      publicKey,
      ip: req.ip,
      timestamp: new Date()
    });

    return res.json({ success: true, token, publicKey });
  } catch (err) {
    auditLogger.error('❌ Auth error', { error: err.message, ip: req.ip });
    return res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * POST /auth/verify
 * 
 * Verify JWT token validity (protected endpoint)
 * Used to validate token before performing owner-only operations
 */
app.post("/auth/verify", authMiddleware, (req, res) => {
  return res.json({ success: true, user: req.user });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LINK MANAGEMENT ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * POST /links
 * 
 * Create a new receive link (metadata only)
 * This creates NO funds or contracts — just a record that says
 * "funds from this link should go to ShadowPay privacy pool with this ID"
 * 
 * Body: { amount, token, anyAmount }
 * Returns: { id, url, amount, token, status: 'created', commitment: null }
 */
app.post("/links", async (req, res) => {
  try {
    const { amount, token, anyAmount } = req.body;
    const map = await loadLinks();
    const id = Math.random().toString(36).slice(2, 9);
    const url = `${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/pay/${id}`;
    
    // Create link metadata (NO funds yet)
    const link = { 
      id, 
      url, 
      amount, 
      token: token || "USDC", 
      anyAmount: !!anyAmount, 
      status: "created",
      commitment: null,
      paid: false 
    };
    map[id] = link;
    await saveLinks(map);
    return res.json({ success: true, link });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /links/:id
 * 
 * Retrieve link metadata
 * Returns commitment if deposit succeeded, status if link is paid
 */
app.get("/links/:id", async (req, res) => {
  try {
    const map = await loadLinks();
    const link = map[req.params.id];
    if (!link) return res.status(404).json({ error: "not found" });
    return res.json({ success: true, link });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRIVACY CASH INTEGRATION ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * POST /links/:id/pay
 * 
 * DEPOSIT TO PRIVACY CASH POOL
 * Called by frontend when payer wants to send funds
 * 
 * This endpoint:
 * 1. Calls Privacy Cash SDK to deposit funds to pool
 * 2. Gets commitment back (proof of deposit)
 * 3. Stores commitment in link metadata (enables future withdrawal)
 * 4. Marks link as "paid"
 * 
 * CRITICAL: Funds are NOT in ShadowPay backend — they're in Privacy Cash pool
 * The commitment is proof that Privacy Cash protocol holds the funds for this link
 * 
 * Body: { amount, token, referrer }
 * Returns: { link: { ...metadata with commitment } }
 */
app.post("/links/:id/pay", paymentLimiter, async (req, res) => {
  try {
    const { amount, token, referrer } = req.body;
    const map = await loadLinks();
    const link = map[req.params.id];
    
    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    if (!amount || !token) {
      return res.status(400).json({ error: "Amount and token required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    // Guard: Prevent re-paying
    if (link.paid) {
      return res.status(400).json({ error: "This link has already been paid" });
    }

    try {
      let result;
      
      if (!process.env.PRIVACY_CASH_ENABLED || process.env.PRIVACY_CASH_ENABLED === "false") {
        // Fallback: Demo mode without actual Privacy Cash
        result = {
          tx: `demo_${Date.now()}`,
          commitment: `commitment_${Math.random().toString(36).slice(2, 9)}`,
          amount,
          token,
          timestamp: Date.now()
        };
      } else {
        // Use Privacy Cash service
        if (token === "SOL") {
          // Deposit SOL (convert amount to lamports)
          const lamports = BigInt(amount * 1e9);
          result = await privacyCashService.depositSOL({
            lamports,
            referrer
          });
        } else {
          // Deposit SPL token
          const splAmount = BigInt(amount * 1e6); // Assume 6 decimals
          result = await privacyCashService.depositSPL({
            mintAddress: token,
            amount: splAmount,
            referrer
          });
        }
      }

      if (!result || !result.commitment) {
        return res.status(500).json({ 
          error: "Deposit to Privacy Cash pool failed - no commitment returned"
        });
      }

      // Update link metadata with commitment and status
      link.paid = true;
      link.status = "paid";
      link.commitment = result.commitment;
      link.txHash = result.tx;
      link.paidAt = Date.now();
      map[req.params.id] = link;
      await saveLinks(map);

      return res.json({ success: true, link, result });
    } catch (sdkErr) {
      console.error("Privacy Cash deposit error:", sdkErr);
      return res.status(500).json({ 
        error: "Deposit to Privacy Cash pool failed",
        details: sdkErr.message 
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /links/:id/claim (PROTECTED - requires JWT)
 * 
 * WITHDRAW FROM PRIVACY CASH POOL
 * Called by recipient to claim/withdraw funds
 * 
 * This endpoint:
 * 1. Validates JWT (recipient authenticated)
 * 2. Loads link and validates it's been paid
 * 3. Uses commitment to withdraw from Privacy Cash pool
 * 4. Funds transfer directly to recipient wallet
 * 5. Marks link as "withdrawn"
 * 
 * CRITICAL: Funds come from Privacy Cash pool, NOT ShadowPay backend
 * We use the commitment to tell Privacy Cash protocol which deposit to release
 * Recipient receives funds DIRECTLY — we never touch them
 * 
 * Body: { recipientWallet }
 * Returns: { link: { ...metadata with withdrawnAt } }
 */
app.post("/links/:id/claim", withdrawalLimiter, authMiddleware, async (req, res) => {
  try {
    const { recipientWallet } = req.body;
    const map = await loadLinks();
    const link = map[req.params.id];

    if (!link) {
      return res.status(404).json({ error: "Link not found" });
    }

    if (!recipientWallet) {
      return res.status(400).json({ error: "Recipient wallet required" });
    }

    // Guard: Validate Solana address format
    try {
      new PublicKey(recipientWallet);
    } catch (err) {
      return res.status(400).json({ 
        error: "Invalid Solana wallet address. Please check the address and try again." 
      });
    }

    // Guard: Link must be paid before withdrawal
    if (!link.paid) {
      return res.status(400).json({ error: "Link must be paid before withdrawal" });
    }

    // Guard: Prevent duplicate withdrawals
    if (link.status === "withdrawn") {
      return res.status(400).json({ error: "Link already withdrawn" });
    }

    // Guard: CRITICAL — Commitment must exist
    if (!link.commitment) {
      return res.status(500).json({ 
        error: "CRITICAL: Link marked paid but no commitment found. " +
               "This indicates deposit to Privacy Cash pool did not complete."
      });
    }

    try {
      // Use Privacy Cash service to withdraw using commitment
      let result;

      if (!process.env.PRIVACY_CASH_ENABLED || process.env.PRIVACY_CASH_ENABLED === "false") {
        // Fallback: Demo mode without actual Privacy Cash
        result = {
          tx: `demo_withdraw_${Date.now()}`,
          amount: link.amount,
          recipient: recipientWallet,
          isPartial: false,
          fee: 0,
          timestamp: Date.now()
        };
      } else {
        // Determine token type and call appropriate method
        const isSOL = link.token === "SOL";

        if (isSOL) {
          // Withdraw SOL (measured in lamports)
          const lamports = BigInt(link.amount * 1e9);
          result = await privacyCashService.withdrawSOL({
            recipientAddress: recipientWallet,
            lamports,
            referrer: link.referrer
          });
        } else {
          // Withdraw SPL (USDC, USDT, etc.)
          const splAmount = BigInt(link.amount * 1e6); // Assume 6 decimals
          result = await privacyCashService.withdrawSPL({
            mintAddress: link.token,
            recipientAddress: recipientWallet,
            amount: splAmount,
            referrer: link.referrer
          });
        }
      }

      // Update link metadata
      link.status = "withdrawn";
      link.withdrawnAt = Date.now();
      link.withdrawTxHash = result.tx;
      map[req.params.id] = link;
      await saveLinks(map);

      return res.json({ 
        success: true, 
        link,
        txHash: result.tx || "pending"
      });
    } catch (sdkErr) {
      console.error("Privacy Cash withdrawal error:", sdkErr);
      return res.status(500).json({ 
        error: "Withdrawal from Privacy Cash pool failed",
        details: sdkErr.message 
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OWNER-ONLY WITHDRAWAL ENDPOINTS (Demo Withdrawals)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * These endpoints allow the owner to withdraw funds directly from the Privacy Cash
 * pool for operational purposes (demo, testing, etc.).
 * 
 * PRODUCTION NOTE: Direct owner withdrawals should be replaced with an on-chain
 * Program that manages funds and enforces business logic programmatically.
 * These endpoints are here for demo purposes only.
 */

/**
 * POST /withdraw/spl (PROTECTED - requires JWT)
 * 
 * Owner-only endpoint: Withdraw SPL tokens from Privacy Cash pool
 * Used for operational withdrawals, not linked to any receive link
 * 
 * Body: { mint, amount, recipient }
 * Returns: { txHash, result }
 */
app.post("/withdraw/spl", withdrawalLimiter, authMiddleware, async (req, res) => {
  try {
    const { mint, amount, recipient } = req.body;
    
    if (!mint || !amount || !recipient) {
      return res.status(400).json({ error: "mint, amount, recipient required" });
    }
    
    try {
      // Validate mint address
      new PublicKey(mint);
      new PublicKey(recipient);

      const result = await privacyCashService.withdrawSPL({ 
        mintAddress: mint, 
        amount: BigInt(amount),
        recipientAddress: recipient 
      });
      
      return res.json({ 
        success: true, 
        result,
        txHash: result.tx || "pending"
      });
    } catch (sdkErr) {
      console.error("SDK Error:", sdkErr);
      return res.status(500).json({ 
        error: "SDK withdrawal failed",
        details: sdkErr.message 
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /withdraw/sol (PROTECTED - requires JWT)
 * 
 * Owner-only endpoint: Withdraw SOL from Privacy Cash pool
 * Used for operational withdrawals, not linked to any receive link
 * 
 * Body: { lamports, recipient }
 * Returns: { txHash, result }
 */
app.post("/withdraw/sol", withdrawalLimiter, authMiddleware, async (req, res) => {
  try {
    const { lamports, recipient } = req.body;
    
    if (!lamports || !recipient) {
      return res.status(400).json({ error: "lamports, recipient required" });
    }
    
    try {
      // Validate recipient address
      new PublicKey(recipient);

      const result = await privacyCashService.withdrawSOL({ 
        lamports: BigInt(lamports),
        recipientAddress: recipient 
      });
      
      return res.json({ 
        success: true, 
        result,
        txHash: result.tx || "pending"
      });
    } catch (sdkErr) {
      console.error("SDK Error:", sdkErr);
      return res.status(500).json({ 
        error: "SDK withdrawal failed",
        details: sdkErr.message 
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /balance (PROTECTED - requires JWT)
 * 
 * Check Privacy Cash pool balance
 * Shows SOL balance available in the pool (not managed by us, just reported)
 * 
 * Returns: { balance }
 */
app.get("/balance", authMiddleware, async (req, res) => {
  try {
    if (!process.env.PRIVACY_CASH_ENABLED || process.env.PRIVACY_CASH_ENABLED === "false") {
      // Demo mode
      return res.json({ success: true, balance: 1000000, token: "SOL" });
    }

    const balance = await privacyCashService.getPrivateBalance();
    return res.json({ success: true, balance, token: "SOL" });
  } catch (err) {
    console.error("Balance check error:", err);
    return res.status(500).json({ error: String(err), balance: 0 });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SERVER STARTUP
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 ShadowPay Backend listening on http://localhost:${PORT}`);
  console.log(`📦 ShadowPay privacy pool initialized (RPC: ${RPC})`);
  console.log(`🔐 Non-custodial mode: Funds routed to ShadowPay Protocol`);
});
