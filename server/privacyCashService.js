/**
 * Privacy Cash Service - Full Integration with Privacy Cash SDK
 * 
 * This service handles all Privacy Cash operations for ShadowPay:
 * - Deposits to privacy pool
 * - Withdrawals from privacy pool
 * - Balance queries
 * - Commitment tracking
 */

import { PrivacyCash } from 'privacycash';
import { PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

let privacyCashClient = null;

/**
 * Initialize Privacy Cash Client
 * This connects to the Privacy Cash smart contract on Solana
 */
export async function initPrivacyCashClient({ rpcUrl, keypair }) {
  if (privacyCashClient) return privacyCashClient;
  
  if (!rpcUrl || !keypair) {
    throw new Error('RPC URL and keypair required to initialize Privacy Cash client');
  }

  try {
    privacyCashClient = new PrivacyCash({
      RPC_url: rpcUrl,
      owner: keypair // Keypair for signing transactions
    });

    console.log('✅ Privacy Cash client initialized');
    return privacyCashClient;
  } catch (err) {
    console.error('❌ Failed to initialize Privacy Cash client:', err);
    throw err;
  }
}

/**
 * Deposit SOL to Privacy Cash Pool
 * 
 * Called when a payer sends funds to a payment link.
 * This deposits the SOL to the Privacy Cash privacy pool.
 * 
 * @param {number} lamports - Amount in lamports
 * @param {string} referrer - Optional referral wallet
 * @returns {Object} { tx: transactionSignature, commitment: proof }
 */
export async function depositSOL({ lamports, referrer }) {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  if (lamports <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  try {
    console.log(`💰 Depositing ${lamports / LAMPORTS_PER_SOL} SOL to Privacy Cash pool...`);

    const result = await privacyCashClient.deposit({
      lamports,
      referrer
    });

    if (!result || !result.tx) {
      throw new Error('Deposit failed: no transaction signature returned');
    }

    console.log(`✅ Deposit successful: ${result.tx}`);

    return {
      tx: result.tx,
      amount: lamports,
      timestamp: Date.now(),
      // Commitment is stored in Privacy Cash state, not returned directly
      // but we can reference the transaction for proof
      commitment: result.tx
    };
  } catch (err) {
    console.error('❌ Deposit failed:', err);
    throw new Error(`Failed to deposit to Privacy Cash: ${err.message}`);
  }
}

/**
 * Deposit SPL Token to Privacy Cash Pool
 * 
 * @param {string} mintAddress - SPL token mint
 * @param {number} amount - Amount in token units
 * @param {string} referrer - Optional referral wallet
 * @returns {Object} { tx: transactionSignature, commitment: proof }
 */
export async function depositSPL({ mintAddress, amount, referrer }) {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  try {
    console.log(`💰 Depositing ${amount} tokens to Privacy Cash pool...`);

    const result = await privacyCashClient.depositSPL({
      mintAddress: new PublicKey(mintAddress),
      amount,
      referrer
    });

    if (!result || !result.tx) {
      throw new Error('SPL deposit failed: no transaction signature returned');
    }

    console.log(`✅ SPL Deposit successful: ${result.tx}`);

    return {
      tx: result.tx,
      amount,
      mintAddress,
      timestamp: Date.now(),
      commitment: result.tx
    };
  } catch (err) {
    console.error('❌ SPL Deposit failed:', err);
    throw new Error(`Failed to deposit SPL to Privacy Cash: ${err.message}`);
  }
}

/**
 * Withdraw SOL from Privacy Cash Pool
 * 
 * Called when recipient claims a payment link and requests withdrawal.
 * Funds are transferred from Privacy Cash pool to recipient's wallet.
 * 
 * @param {string} recipientAddress - Recipient wallet public key
 * @param {number} lamports - Amount in lamports to withdraw
 * @param {string} referrer - Optional referral wallet
 * @returns {Object} { tx: transactionSignature, amount, recipient }
 */
export async function withdrawSOL({ recipientAddress, lamports, referrer }) {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  if (!recipientAddress) {
    throw new Error('Recipient address required');
  }

  if (lamports <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  try {
    console.log(`💸 Withdrawing ${lamports / LAMPORTS_PER_SOL} SOL to ${recipientAddress}...`);

    const result = await privacyCashClient.withdraw({
      lamports,
      recipientAddress,
      referrer
    });

    if (!result || !result.tx) {
      throw new Error('Withdrawal failed: no transaction signature returned');
    }

    console.log(`✅ Withdrawal successful: ${result.tx}`);

    return {
      tx: result.tx,
      amount: lamports,
      recipient: recipientAddress,
      isPartial: result.isPartial || false,
      fee: result.fee_in_lamports || 0,
      timestamp: Date.now()
    };
  } catch (err) {
    console.error('❌ Withdrawal failed:', err);
    throw new Error(`Failed to withdraw from Privacy Cash: ${err.message}`);
  }
}

/**
 * Withdraw SPL Token from Privacy Cash Pool
 * 
 * @param {string} mintAddress - SPL token mint
 * @param {string} recipientAddress - Recipient wallet public key
 * @param {number} amount - Amount in token units
 * @param {string} referrer - Optional referral wallet
 * @returns {Object} { tx: transactionSignature, amount, recipient }
 */
export async function withdrawSPL({ mintAddress, recipientAddress, amount, referrer }) {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  if (!recipientAddress) {
    throw new Error('Recipient address required');
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  try {
    console.log(`💸 Withdrawing ${amount} tokens to ${recipientAddress}...`);

    const result = await privacyCashClient.withdrawSPL({
      mintAddress: new PublicKey(mintAddress),
      amount,
      recipientAddress,
      referrer
    });

    if (!result || !result.tx) {
      throw new Error('SPL withdrawal failed: no transaction signature returned');
    }

    console.log(`✅ SPL Withdrawal successful: ${result.tx}`);

    return {
      tx: result.tx,
      amount,
      mintAddress,
      recipient: recipientAddress,
      isPartial: result.isPartial || false,
      fee: result.fee || 0,
      timestamp: Date.now()
    };
  } catch (err) {
    console.error('❌ SPL Withdrawal failed:', err);
    throw new Error(`Failed to withdraw SPL from Privacy Cash: ${err.message}`);
  }
}

/**
 * Get Private Balance from Privacy Cash Pool
 * 
 * Query how much SOL the user has in the Privacy Cash pool
 */
export async function getPrivateBalance() {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  try {
    const balance = await privacyCashClient.getPrivateBalance();
    return {
      lamports: balance.lamports,
      sol: balance.lamports / LAMPORTS_PER_SOL
    };
  } catch (err) {
    console.error('❌ Failed to get balance:', err);
    throw new Error(`Failed to get private balance: ${err.message}`);
  }
}

/**
 * Get SPL Token Balance from Privacy Cash Pool
 * 
 * @param {string} mintAddress - SPL token mint
 */
export async function getPrivateBalanceSPL({ mintAddress }) {
  if (!privacyCashClient) {
    throw new Error('Privacy Cash client not initialized');
  }

  try {
    const balance = await privacyCashClient.getPrivateBalanceSpl(
      new PublicKey(mintAddress)
    );
    return {
      units: balance.units,
      amount: balance.amount
    };
  } catch (err) {
    console.error('❌ Failed to get SPL balance:', err);
    throw new Error(`Failed to get SPL balance: ${err.message}`);
  }
}

/**
 * Check if Privacy Cash client is initialized
 */
export function isClientInitialized() {
  return privacyCashClient !== null;
}
