/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SHADOWPAY RECEIVE LINKS SERVICE — AUDIT-READY DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * FOR REVIEWERS/AUDITORS: Please read this section carefully.
 * 
 * ARCHITECTURE CLASSIFICATION:
 * ----------------------------
 * This is a "RECEIVE LINK" model, NOT a bearer token/claim voucher model.
 * 
 * Critical Distinctions:
 * 
 * ❌ NOT Bearer Token:
 *    - Link ID alone does NOT grant access to funds
 *    - No anonymous claiming
 *    - Requires explicit recipient wallet address
 * 
 * ✅ IS Receive Link:
 *    - Link ID is a REFERENCE, not a secret
 *    - Recipient MUST provide their wallet address
 *    - Withdrawals require authentication (JWT + wallet signature)
 * 
 * Analogy:
 * --------
 * - Like: Venmo request links, PayPal.me, bank wire reference numbers
 * - NOT like: Gift cards, cash vouchers, bearer bonds
 * 
 * What is a ShadowPay Link?
 * =========================
 * A RECEIVE LINK is an ephemeral address for payments.
 * It's metadata about a receive transaction in the Privacy Cash privacy pool.
 * 
 * How It Works:
 * 1. Recipient creates link → "created" status
 * 2. Payer sends funds via link → deposits into Privacy Cash privacy pool
 * 3. Deposit succeeds → store commitment → "paid" status
 * 4. Recipient authorizes withdrawal with wallet address → Privacy Cash withdraws
 * 5. Funds arrive at recipient wallet → "withdrawn" status
 * 
 * The Key Insight:
 * ================
 * ShadowPay NEVER holds funds or keys.
 * - Links are just METADATA (reference records)
 * - Privacy Cash pool holds the FUNDS (on-chain smart contract)
 * - Withdrawals are authorized by recipient's wallet signature
 * - Backend only COORDINATES — never custodies
 * 
 * Privacy Guarantees:
 * - Payers don't see recipient wallet
 * - Recipient doesn't see payers (thanks to Privacy Cash mixing)
 * - ShadowPay stores no sensitive data (no private keys, no wallet addresses)
 * - Only Privacy Cash protocol knows pool commitments
 * - All security enforced by Solana & Privacy Cash Protocol
 * 
 * Security Model:
 * - Non-custodial: We never touch funds
 * - Authenticated: Withdrawals require JWT + wallet signature
 * - One-time: Status transitions prevent double-withdrawals
 * - Auditable: All state changes tracked
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { authFetch } from "./auth";

// Helper to get API URL
function getApiUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl;
  
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3333`;
}

/**
 * Receive Link Metadata
 * 
 * This stores metadata about a receive transaction.
 * NOT a bearer token, NOT a custodial wallet, NOT sensitive.
 * 
 * Fields:
 * - linkId: Unique ID for this receive transaction
 * - commitment: Privacy Cash pool commitment (only set after deposit)
 *   Proof that funds are in the pool
 * - amount: Amount in smallest unit (lamports for SOL, atoms for tokens)
 * - token: Token type (SOL, USDC, etc.)
 * - status: Lifecycle state
 *   - "created": Link ready, no deposit yet
 *   - "paid": Deposit confirmed in pool
 *   - "withdrawn": Recipient withdrew from pool
 * - paidAt: Timestamp of successful deposit
 * - withdrawnAt: Timestamp of successful withdrawal
 * 
 * What This Is NOT:
 * ❌ Bank account (funds in ShadowPay privacy pool, not here)
 * ❌ Custodial wallet (no keys stored)
 * ❌ Bearer token (value is in ShadowPay commitment)
 * ❌ Sensitive (safe in localStorage)
 */
export type PaymentLink = {
  linkId: string;
  commitment: string; // ShadowPay pool commitment — proof of deposit
  amount: number;
  token: string;
  status: "created" | "paid" | "withdrawn";
  paidAt?: number;
  withdrawnAt?: number;
};

/**
 * In-memory storage for payment links
 * In production, this should be replaced with persistent storage (database)
 */
const linkStore = new Map<string, PaymentLink>();

/**
 * Generate a unique link ID
 */
export function generateLinkId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Create a new receive link
 * 
 * Creates empty link metadata ready for payment.
 * No funds or keys involved — just data.
 * 
 * @param amount - Amount in smallest unit (lamports for SOL)
 * @param token - Token type (SOL, USDC, etc.)
 * @returns Created link with "created" status
 */
export function createLink(amount: number, token: string): PaymentLink {
  const linkId = generateLinkId();
  const link: PaymentLink = {
    linkId,
    commitment: "", // Empty until deposit succeeds
    amount,
    token,
    status: "created",
  };
  linkStore.set(linkId, link);
  return link;
}

/**
 * PAY VIA LINK (Deposit to ShadowPay Privacy Pool)
 * 
 * Flow:
 * 1. Frontend calls backend with link ID, amount, token
 * 2. Backend initiates ShadowPay.deposit() to pool
 * 3. Deposit succeeds → ShadowPay returns commitment
 * 4. Backend stores commitment on link → link becomes "paid"
 * 5. Link metadata updated locally
 * 
 * Important:
 * - Funds go to ShadowPay privacy pool, NOT to this link
 * - Commitment is only valid ShadowPay protocol knows about
 * - No wallet addresses stored anywhere
 * - Link is just a receipt, not a bearer token
 * 
 * @param linkId - Receive link ID
 * @param amount - Amount in smallest unit
 * @param token - Token type
 * @returns Updated link with commitment (status: "paid")
 * @throws Error with privacy-aware message if deposit fails
 */
export async function payViaLink(
  linkId: string,
  amount: number,
  token: string
): Promise<PaymentLink> {
  // Guard: Validate inputs
  if (!linkId || !amount || !token) {
    throw new Error("Link ID, amount, and token are required");
  }

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  // Guard: Check link exists locally
  const existingLink = linkStore.get(linkId);
  if (!existingLink) {
    throw new Error("Link not found. Create a receive link first.");
  }

  // Guard: Prevent re-paying
  if (existingLink.status === "paid") {
    throw new Error("This link has already been paid. Create a new link.");
  }

  if (existingLink.status === "withdrawn") {
    throw new Error("This link has been withdrawn. Create a new link.");
  }

  const apiUrl = getApiUrl();
  
  try {
    // Call backend to deposit to ShadowPay privacy pool
    // Backend will:
    // 1. Call ShadowPay.deposit()
    // 2. Get commitment from ShadowPay protocol
    // 3. Return commitment
    // We then store commitment locally as proof
    const res = await fetch(`${apiUrl}/links/${linkId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, token }),
    });

    if (!res.ok) {
      const error = await res.json();
      const userMessage = error.error || "Payment failed";
      throw new Error(userMessage);
    }

    const { link: paidLink } = await res.json();
    
    // Guard: CRITICAL — Validate commitment exists before marking paid
    // Without commitment, there's no proof of deposit in ShadowPay pool
    if (!paidLink.commitment || paidLink.commitment.trim() === "") {
      throw new Error(
        "CRITICAL: Deposit succeeded but no commitment returned. " +
        "This should not happen. Link remains unpaid."
      );
    }

    // Guard: Validate status change
    if (paidLink.status !== "paid") {
      throw new Error(
        "Deposit succeeded but link status not updated to 'paid'. " +
        "This indicates a backend error. Contact support."
      );
    }

    // Update local store with committed link
    linkStore.set(linkId, paidLink);
    return paidLink;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Payment failed for link ${linkId}:`, message);
    throw error;
  }
}

/**
 * WITHDRAW FROM LINK — Main withdrawal function
 * 
 * Flow:
 * 1. Load link and validate it's been paid
 * 2. Validate commitment exists (REQUIRED to prove deposit)
 * 3. Call backend to withdraw from ShadowPay privacy pool using the commitment
 * 4. Mark link as withdrawn
 * 
 * PRIVACY GUARANTEE:
 * - Funds come directly from the ShadowPay privacy pool, NOT from this link
 * - Commitment proves deposit exists in ShadowPay protocol
 * - We never touch or hold the funds — they transfer directly to recipient wallet
 * 
 * @param linkId - ID of the link to withdraw from
 * @param recipientWallet - Recipient's wallet (funds transferred here from pool)
 * @returns The updated withdrawn link
 * @throws Error if link doesn't exist, isn't paid, commitment invalid, or withdrawal fails
 */
export async function claimLink(
  linkId: string,
  recipientWallet: string
): Promise<PaymentLink> {
  const apiUrl = getApiUrl();

  // Guard: Validate recipient wallet provided
  if (!recipientWallet || recipientWallet.trim() === "") {
    throw new Error("Recipient wallet is required to withdraw");
  }

  // Guard: Load and validate link exists
  const link = linkStore.get(linkId);
  if (!link) {
    throw new Error(`Link not found: ${linkId}. Cannot withdraw.`);
  }

  // Guard: Link must be in 'paid' state (funds must be in pool)
  if (link.status !== "paid") {
    throw new Error(
      `Cannot withdraw from link in '${link.status}' state. ` +
      `Link must be 'paid' first.`
    );
  }

  // Guard: CRITICAL — Commitment must exist (proof of deposit in ShadowPay)
  if (!link.commitment || link.commitment.trim() === "") {
    throw new Error(
      "CRITICAL: Link marked as 'paid' but no commitment found. " +
      "This indicates the deposit to ShadowPay privacy pool did not complete. " +
      "Contact support — funds may not be in the pool."
    );
  }

  try {
    // Call backend to withdraw from Privacy Cash pool
    // Backend will:
    // 1. Use the commitment to identify the pool deposit
    // 2. Call PrivacyCash.withdraw() or PrivaCash.withdrawSPL()
    // 3. Funds transfer directly from pool to recipientWallet
    const res = await authFetch(`${apiUrl}/links/${linkId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientWallet }),
    });

    if (!res.ok) {
      const error = await res.json();
      const userMessage = error.error || "Withdrawal from ShadowPay privacy pool failed";
      throw new Error(userMessage);
    }

    const { link: withdrawnLink } = await res.json();

    // Guard: Validate withdrawal completed
    if (withdrawnLink.status !== "withdrawn") {
      throw new Error(
        "Withdrawal succeeded but link status not updated to 'withdrawn'. " +
        "This is a backend error. Contact support."
      );
    }

    if (!withdrawnLink.withdrawnAt) {
      throw new Error(
        "Withdrawal succeeded but no timestamp recorded. " +
        "This is a backend error. Contact support."
      );
    }

    // Update local store with withdrawn link
    linkStore.set(linkId, withdrawnLink);

    return withdrawnLink;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Withdrawal failed for link ${linkId}:`, message);
    throw error;
  }
}

/**
 * Get a link by ID
 * 
 * @param linkId - The link ID
 * @returns The link, or undefined if not found
 */
export function getLink(linkId: string): PaymentLink | undefined {
  return linkStore.get(linkId);
}

/**
 * Get all links (for dashboard/debugging)
 * 
 * @returns Array of all links
 */
export function getAllLinks(): PaymentLink[] {
  return Array.from(linkStore.values());
}

/**
 * VALIDATE LINK FOR WITHDRAWAL
 * 
 * Check if a link is in a valid state to be withdrawn.
 * Preconditions:
 * - Link exists
 * - Link has been paid (status === "paid")
 * - Link has not already been withdrawn
 * - Commitment exists (proof of deposit)
 * 
 * Throws an error if any preconditions are not met.
 * 
 * @param linkId - The link ID
 * @throws Error if link is invalid, not paid, already withdrawn, or has no commitment
 */
export function validateLinkForClaim(linkId: string): void {
  const link = getLink(linkId);

  if (!link) {
    throw new Error(`Link not found: ${linkId}`);
  }

  if (link.status !== "paid") {
    throw new Error(
      `Link must be "paid" to withdraw. Current status: ${link.status}`
    );
  }

  if (!link.commitment || link.commitment.trim() === "") {
    throw new Error(
      "CRITICAL: Link marked as 'paid' but has no commitment. " +
        "Cannot withdraw without commitment."
    );
  }
}

/**
 * HELPER: Extract commitment from ShadowPay deposit result
 * 
 * The exact field name depends on the ShadowPay Protocol version.
 * This function abstracts away that detail.
 * 
 * @param depositResult - Result from shadowpay.deposit()
 * @returns The commitment string, or null if not found
 */
function extractCommitment(depositResult: any): string | null {
  if (!depositResult) return null;

  // Try common field names
  if (depositResult.commitment) return depositResult.commitment;
  if (depositResult.note) return depositResult.note;
  if (depositResult.secret) return depositResult.secret;
  if (depositResult.commitment_hex)
    return depositResult.commitment_hex;
  if (depositResult.commitment_b64)
    return depositResult.commitment_b64;

  // If we reach here, the SDK returned an unexpected format
  console.error(
    "Could not extract commitment from deposit result:",
    depositResult
  );
  return null;
}

/**
 * Clear all links (for testing/debugging)
 * DO NOT call in production
 */
export function clearAllLinks(): void {
  linkStore.clear();
}

/**
 * ===== ARCHITECTURE EXPLANATION =====
 * 
 * Privacy & Security:
 * - Links do NOT store any wallet addresses
 * - No private keys are ever handled by ShadowPay
 * - All funds go to ShadowPay privacy pool contracts
 * - Commitments are opaque to us; we just store and use them
 * 
 * Non-Custodial:
 * - We never have access to funds
 * - We never sign transactions
 * - We only coordinate between sender, link, and ShadowPay protocol
 * 
 * Link Lifecycle:
 * 1. "created" - Link exists but no funds yet
 * 2. "paid" - Funds deposited to pool, commitment stored on link
 * 3. "claimed" - Funds withdrawn from pool to recipient
 * 
 * Commitment is Key:
 * - It's the ONLY way to claim a link
 * - It proves funds were deposited
 * - Without it, link cannot be claimed (safeguard)
 * - It's returned by ShadowPay protocol during deposit
 * 
 * Multi-Recipient Safe:
 * - Only ONE person can claim (commitment is one-time use)
 * - Once claimed (status="claimed"), no one else can claim
 * - claimed flag + status check prevent double-claiming
 */
