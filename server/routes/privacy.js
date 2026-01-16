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
 * Request deposit to Privacy Cash pool via relayer
 */
router.post('/deposit', async (req, res) => {
  try {
    const { lamports, walletAddress, linkId } = req.body;

    if (!lamports || lamports <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address required'
      });
    }

    console.log(`📡 Forwarding deposit request to relayer...`);
    console.log(`   Amount: ${lamports / 1e9} SOL`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Link: ${linkId || 'none'}`);

    // Call relayer service
    const relayerResponse = await fetch(`${RELAYER_URL}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RELAYER_AUTH_SECRET && {
          'x-relayer-auth': RELAYER_AUTH_SECRET
        })
      },
      body: JSON.stringify({
        lamports,
        payerPublicKey: walletAddress,
        linkId,
      })
    });

    if (!relayerResponse.ok) {
      const error = await relayerResponse.json();
      throw new Error(error.error || 'Relayer deposit failed');
    }

    const result = await relayerResponse.json();
    
    console.log(`✅ Deposit successful via relayer`);
    console.log(`   TX: ${result.tx}`);
    console.log(`   Commitment: ${result.commitment}`);

    res.json({
      success: true,
      txSignature: result.tx,
      commitment: result.commitment,
      amount: lamports / 1e9,
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
