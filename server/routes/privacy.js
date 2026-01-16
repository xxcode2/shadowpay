/**
 * Privacy Cash API Routes
 * 
 * CORRECT ARCHITECTURE: Relayer handles all deposits via Privacy Cash SDK
 * User does NOT sign transactions (privacy-preserving)
 * Relayer pays gas fees and generates ZK proofs
 */

import express from 'express';

const router = express.Router();

// Environment
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:4444';
const RELAYER_AUTH_SECRET = process.env.RELAYER_AUTH_SECRET;

/**
 * POST /api/privacy/build-deposit
 * Build Privacy Cash deposit transaction (backend)
 * Returns serialized transaction for user to sign
 */
router.post('/build-deposit', async (req, res) => {
  try {
    const { amountLamports, userPublicKey, linkId } = req.body;

    if (!amountLamports || amountLamports <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!userPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'User public key required'
      });
    }

    console.log(`🏗️  Building Privacy Cash transaction...`);
    console.log(`   Amount: ${amountLamports / 1e9} SOL`);
    console.log(`   User: ${userPublicKey}`);
    console.log(`   Link: ${linkId}`);

    // Forward to relayer to build transaction with Privacy Cash SDK
    const relayerResponse = await fetch(`${RELAYER_URL}/build-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        lamports: amountLamports,
        userPublicKey,
        linkId
      })
    });

    if (!relayerResponse.ok) {
      const error = await relayerResponse.json();
      throw new Error(error.error || 'Failed to build transaction');
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Transaction built successfully`);
    console.log(`   Return to frontend for signing`);

    res.json({
      success: true,
      transaction: result.transaction, // Base64 serialized transaction
      message: 'Transaction ready for signing'
    });

  } catch (error) {
    console.error('❌ Build transaction failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to build transaction'
    });
  }
});

/**
 * POST /api/privacy/deposit
 * Request Privacy Cash deposit via relayer
 * User does NOT sign - relayer handles everything
 */
router.post('/deposit', async (req, res) => {
  try {
    const { linkId, amount, lamports } = req.body;

    // Accept either amount (SOL) or lamports
    const depositAmount = amount || (lamports ? lamports / 1e9 : null);

    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!linkId) {
      return res.status(400).json({
        success: false,
        message: 'Link ID required'
      });
    }

    console.log(`📡 Forwarding Privacy Cash deposit to relayer...`);
    console.log(`   Amount: ${depositAmount} SOL`);
    console.log(`   Link: ${linkId}`);

    // Forward to relayer - relayer will call Privacy Cash SDK
    const relayerResponse = await fetch(`${RELAYER_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        amount: depositAmount,
        linkId
      })
    });

    if (!relayerResponse.ok) {
      const errorText = await relayerResponse.text();
      let errorMessage = 'Failed to process deposit';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${relayerResponse.status}`;
      }
      
      // CRITICAL: Log for debugging
      console.error('❌ Relayer error response:');
      console.error('   Status:', relayerResponse.status);
      console.error('   Message:', errorMessage);
      console.error('   URL:', `${RELAYER_URL}/deposit`);
      console.error('   Auth header present:', !!RELAYER_AUTH_SECRET);
      
      throw new Error(`Relayer error (${relayerResponse.status}): ${errorMessage}`);
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Deposit successful`);
    console.log(`   TX: ${result.txSignature}`);
    console.log(`   Commitment: ${result.commitment || 'N/A'}`);

    res.json({
      success: true,
      txSignature: result.txSignature,
      commitment: result.commitment,
      amount: result.amount
    });

  } catch (error) {
    console.error('❌ Deposit failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deposit'
    });
  }
});

/**
 * POST /api/privacy/withdraw
 * Request withdrawal from Privacy Cash pool via relayer
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { lamports, recipientAddress, commitment, linkId } = req.body;

    if (!lamports || lamports <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!recipientAddress) {
      return res.status(400).json({
        success: false,
        message: 'Recipient address required'
      });
    }

    if (!commitment) {
      return res.status(400).json({
        success: false,
        message: 'Commitment required for withdrawal'
      });
    }

    console.log(`📡 Forwarding withdrawal request to relayer...`);
    console.log(`   Amount: ${lamports / 1e9} SOL`);
    console.log(`   Recipient: ${recipientAddress}`);

    // Call relayer service
    const relayerResponse = await fetch(`${RELAYER_URL}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        lamports,
        recipient: recipientAddress,
        commitment,
        linkId,
      })
    });

    if (!relayerResponse.ok) {
      const error = await relayerResponse.json();
      throw new Error(error.error || 'Relayer withdrawal failed');
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Withdrawal successful via relayer`);
    console.log(`   TX: ${result.tx}`);

    res.json({
      success: true,
      txSignature: result.tx,
      amount: lamports / 1e9,
      recipient: recipientAddress,
      message: 'Withdrawal successful'
    });

  } catch (error) {
    console.error('❌ Withdrawal request failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Withdrawal failed'
    });
  }
});

export default router;
