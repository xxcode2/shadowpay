/**
 * Privacy Cash API Routes
 * 
 * SIMPLIFIED: Direct SOL transfers for deposits
 * Privacy Cash SDK used only for withdrawals (ZK proofs)
 */

import express from 'express';

const router = express.Router();

// Environment
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:4444';
const RELAYER_AUTH_SECRET = process.env.RELAYER_AUTH_SECRET;

/**
 * POST /api/privacy/deposit
 * Record deposit transaction (user pays directly with Phantom)
 * Privacy Cash used only for withdrawals when recipient claims
 */
router.post('/deposit', async (req, res) => {
  try {
    const { txSignature, linkId, amount } = req.body;

    if (!txSignature) {
      return res.status(400).json({
        success: false,
        message: 'Transaction signature required'
      });
    }

    console.log(`📝 Recording deposit...`);
    console.log(`   TX: ${txSignature}`);
    console.log(`   Link: ${linkId || 'none'}`);

    // Forward to relayer for verification
    const relayerResponse = await fetch(`${RELAYER_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        txSignature,
        linkId,
        amount
      })
    });

    if (!relayerResponse.ok) {
      const errorText = await relayerResponse.text();
      let errorMessage = 'Failed to verify deposit';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${relayerResponse.status}`;
      }
      
      console.error('❌ Relayer error:', errorMessage);
      throw new Error(errorMessage);
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Deposit recorded`);

    res.json({
      success: true,
      txSignature,
      verified: result.verified
    });

  } catch (error) {
    console.error('❌ Record deposit failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record deposit'
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
