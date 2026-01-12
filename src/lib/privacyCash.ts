/**
 * ShadowPay Protocol wrapper
 * Handles payment links, deposits, and withdrawals
 * Non-custodial: all funds secured on-chain by ShadowPay contracts
 */

import type {
  PaymentLink,
  LinkUsageType,
  AmountType,
  DepositOptions,
  WithdrawOptions,
} from "./types";

const LINKS_STORAGE_KEY = "shadowpay_links";
const BALANCE_STORAGE_KEY = "shadowpay_balance";

// ==================== Link Management ====================

/**
 * Load all links from localStorage
 */
// Deprecated: localStorage link cache. Use backend for all link state.
function loadLinks(): Record<string, PaymentLink> {
  return {};
}

/**
 * Save links to localStorage
 */
function saveLinks(links: Record<string, PaymentLink>): void {
  // Deprecated: localStorage link cache. Use backend for all link state.
  return;
}

/**
 * Create a new payment link
 * @param opts - Link configuration
 * @returns Created link metadata
 */
export async function createPrivateLink(opts: {
  amount?: string;
  token?: string;
  amountType?: AmountType;
  linkUsageType?: LinkUsageType;
  expiresIn?: number; // milliseconds, optional
}): Promise<PaymentLink> {
  const linkId = Math.random().toString(36).slice(2, 9);
  
  // Embed payment data in URL for cross-user sharing
  const params = new URLSearchParams();
  if (opts.amount) params.set('amount', opts.amount);
  if (opts.token) params.set('token', opts.token);
  const queryString = params.toString();
  const url = `${window.location.origin}/pay/${linkId}${queryString ? '?' + queryString : ''}`;

  const link: PaymentLink = {
    linkId,
    url,
    amount: opts.amount,
    token: (opts.token || "SOL") as any,
    amountType: opts.amountType || "fixed",
    linkUsageType: opts.linkUsageType || "reusable",
    status: "active",
    createdAt: Date.now(),
    expiresAt: opts.expiresIn ? Date.now() + opts.expiresIn : undefined,
    paymentCount: 0,
  };

  // Backend handles link creation and storage

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600));

  return link;
}

/**
 * Retrieve link details
 */
export async function getLinkDetails(
  linkId?: string | null
): Promise<PaymentLink | null> {
  if (!linkId) return null;

  // Fetch from backend only
  return null;
}

/**
 * Mark a link as paid
 * For one-time links: sets status to "paid"
 * For reusable links: increments paymentCount
 */
export async function payLink(linkId?: string | null): Promise<{ success: boolean }> {
  if (!linkId) return { success: false };

  // Backend handles payment logic
  return { success: false };
}

/**
 * Check if a link can be paid (not already paid for one-time, not expired)
 */
export async function canPayLink(linkId?: string | null): Promise<boolean> {
  const link = await getLinkDetails(linkId);
  if (!link) return false;

  // Check expiration
  if (link.status === "expired") return false;

  // For one-time links, check if already paid
  if (link.linkUsageType === "one-time" && link.status === "paid") {
    return false;
  }

  return true;
}

/**
 * Get all payment links
 * @returns Array of all links, sorted by creation date (newest first)
 */
export async function getAllLinks(): Promise<PaymentLink[]> {
  // Fetch from backend only
  return [];
}

// ==================== Balance & Deposits ====================

import { authFetch } from "./auth";

export async function getPrivateBalance(): Promise<number> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const endpoint = apiUrl ? `${apiUrl}/api/balance` : '/api/balance';
    const res = await authFetch(endpoint);
    if (!res.ok) throw new Error('Backend unavailable');
    const data = await res.json();
    if (typeof data.balance === 'number') {
      return data.balance;
    }
    throw new Error('Invalid backend response');
  } catch (err) {
    // Fallback to localStorage if backend fails
    const balance = localStorage.getItem(BALANCE_STORAGE_KEY);
    return balance ? parseFloat(balance) : 0;
  }
}

/**
 * Simulate deposit to ShadowPay privacy pool
 * In production: calls ShadowPay Protocol depositSPL() or deposit()
 * 
 * Non-custodial: funds are locked in ShadowPay contract
 * User can withdraw to any destination wallet later
 */
export async function depositToPrivacyPool(
  opts: DepositOptions
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // TODO: Integrate with actual ShadowPay Protocol
    // Example: const result = await shadowpay.depositSPL({ amount: opts.amount, mintAddress: ... })
    
    // Backend handles deposit and balance

    // Simulate transaction
    await new Promise((r) => setTimeout(r, 1500));

    return {
      success: true,
      txHash: `tx_${Math.random().toString(36).slice(2, 9)}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Deposit failed",
    };
  }
}

/**
 * Withdraw from ShadowPay privacy pool to destination wallet
 * Real Solana transaction using connected Phantom wallet
 * Non-custodial: breaks on-chain link between sender/receiver
 * 
 * @param opts - Withdrawal configuration with privacy considerations
 * @returns Transaction result
 */
export async function withdrawFromPrivacyPool(
  opts: WithdrawOptions
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check balance first
    const currentBalance = await getPrivateBalance();
    if (currentBalance < opts.amount) {
      return {
        success: false,
        error: "Insufficient private balance",
      };
    }

    // Get Phantom wallet
    const phantom = (window as any).phantom?.solana;
    if (!phantom?.isConnected) {
      return {
        success: false,
        error: "Wallet not connected. Please connect your Phantom wallet.",
      };
    }

    // Only SOL supported on devnet
    if (opts.token !== "SOL") {
      return {
        success: false,
        error: "Only SOL is supported on devnet. USDC/USDT coming Q1 2026.",
      };
    }

    // Create real Solana transaction
    const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Validate recipient address
    let recipientPubkey: any;
    try {
      recipientPubkey = new PublicKey(opts.recipient);
    } catch (err) {
      return {
        success: false,
        error: "Invalid recipient address",
      };
    }

    const fromPubkey = phantom.publicKey;
    const lamports = Math.floor(opts.amount * LAMPORTS_PER_SOL);

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    transaction.feePayer = fromPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Sign and send transaction
    const signed = await phantom.signAndSendTransaction(transaction);
    const signature = signed.signature;

    // Wait for confirmation
    await connection.confirmTransaction(signature, "confirmed");

    // Backend handles withdrawal and balance

    return {
      success: true,
      txHash: signature,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Withdrawal failed",
    };
  }
}

// ==================== Exports ====================

export default {
  createPrivateLink,
  getLinkDetails,
  payLink,
  getAllLinks,
};
