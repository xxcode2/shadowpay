/**
 * Privacy Cash API Routes
 * 
 * Backend endpoints untuk Privacy Cash operations via relayer.
 * Semua ZK proof generation dan SDK operations di relayer.
 */

import express from 'express';

const router = express.Router();

// Environment
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:4444';
const RELAYER_AUTH_SECRET = process.env.RELAYER_AUTH_SECRET;

/**
 * POST /api/privacy/deposit
 * Forward user-signed Privacy Cash deposit transaction to relayer
 * 
 * Architecture:
 * 1. Frontend: User builds & signs TX with Privacy Cash SDK
 * 2. Backend: Receives signed TX and forwards to relayer
 * 3. Relayer: Submits signed TX to blockchain
 * 
 * NOTE: User is fee payer (Privacy Cash design requirement)
 */
router.post('/deposit', async (req, res) => {
  try {
    const { signedTransaction, linkId } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        message: 'signedTransaction required (user must sign in browser)'
      });
    }

    console.log(`📡 Forwarding signed deposit transaction to relayer...`);
    console.log(`   Link: ${linkId || 'none'}`);

    // Forward signed transaction to relayer
    const relayerResponse = await fetch(`${RELAYER_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        signedTransaction,
        linkId,
      })
    });

    if (!relayerResponse.ok) {
      const errorText = await relayerResponse.text();
      let errorMessage = 'Relayer submission failed';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${relayerResponse.status}`;
      }
      
      console.error('❌ Relayer error:', errorMessage);
      console.error('❌ Status:', relayerResponse.status);
      
      throw new Error(errorMessage);
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Deposit transaction submitted successfully`);
    console.log(`   TX: ${result.tx}`);

    res.json({
      success: true,
      txSignature: result.tx,
      message: 'Deposit successful'
    });

  } catch (error) {
    console.error('❌ Deposit request failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Deposit failed'
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
