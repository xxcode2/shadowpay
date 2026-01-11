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
function loadLinks(): Record<string, PaymentLink> {
  try {
    return JSON.parse(localStorage.getItem(LINKS_STORAGE_KEY) || "{}");
  } catch (e) {
    console.error("Failed to load links:", e);
    return {};
  }
}

/**
 * Save links to localStorage
 */
function saveLinks(links: Record<string, PaymentLink>): void {
  localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
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
  const url = `${window.location.origin}/pay/${linkId}`;

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

  const links = loadLinks();
  links[linkId] = link;
  saveLinks(links);

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

  const links = loadLinks();
  const link = links[linkId];

  if (!link) return null;

  // Check if link has expired
  if (link.expiresAt && Date.now() > link.expiresAt) {
    link.status = "expired";
    saveLinks(links);
    return link;
  }

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 250));

  return link;
}

/**
 * Mark a link as paid
 * For one-time links: sets status to "paid"
 * For reusable links: increments paymentCount
 */
export async function payLink(linkId?: string | null): Promise<{ success: boolean }> {
  if (!linkId) return { success: false };

  const links = loadLinks();
  const link = links[linkId];

  if (!link) return { success: false };

  // For one-time links, mark as paid and prevent further payments
  if (link.linkUsageType === "one-time") {
    link.status = "paid";
    link.paidAt = Date.now();
  } else {
    // For reusable links, just increment counter
    link.paymentCount++;
    link.paidAt = Date.now();
  }

  saveLinks(links);

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 900));

  return { success: true };
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
  const links = loadLinks();
  const linkArray = Object.values(links);
  
  // Sort by creation date, newest first
  linkArray.sort((a, b) => b.createdAt - a.createdAt);
  
  // Update expired links
  let hasUpdates = false;
  linkArray.forEach(link => {
    if (link.expiresAt && Date.now() > link.expiresAt && link.status !== "expired") {
      link.status = "expired";
      hasUpdates = true;
    }
  });
  
  if (hasUpdates) {
    saveLinks(links);
  }
  
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 200));
  
  return linkArray;
}

// ==================== Balance & Deposits ====================

/**
 * Get current private balance from local state
 * In production: would query ShadowPay smart contract
 */
export async function getPrivateBalance(): Promise<number> {
  const balance = localStorage.getItem(BALANCE_STORAGE_KEY);
  await new Promise((r) => setTimeout(r, 300));
  return balance ? parseFloat(balance) : 0;
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
    
    const currentBalance = await getPrivateBalance();
    const newBalance = currentBalance + opts.amount;
    localStorage.setItem(BALANCE_STORAGE_KEY, newBalance.toString());

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
 * Non-custodial: breaks on-chain link between sender/receiver
 * 
 * @param opts - Withdrawal configuration with privacy considerations
 * @returns Transaction result
 */
export async function withdrawFromPrivacyPool(
  opts: WithdrawOptions
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // TODO: Integrate with actual ShadowPay Protocol
    // Example: const result = await shadowpay.withdrawSPL({
    //   amount: opts.amount,
    //   mintAddress: ...,
    //   recipientAddress: opts.recipient
    // })

    const currentBalance = await getPrivateBalance();
    if (currentBalance < opts.amount) {
      return {
        success: false,
        error: "Insufficient private balance",
      };
    }

    const newBalance = currentBalance - opts.amount;
    localStorage.setItem(BALANCE_STORAGE_KEY, newBalance.toString());

    // Simulate transaction
    await new Promise((r) => setTimeout(r, 2000));

    return {
      success: true,
      txHash: `tx_${Math.random().toString(36).slice(2, 9)}`,
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
  canPayLink,
  getAllLinks,
  getPrivateBalance,
  depositToPrivacyPool,
  withdrawFromPrivacyPool,
};
