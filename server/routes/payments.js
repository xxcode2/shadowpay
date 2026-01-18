/**
 * ✅ DEPRECATED ROUTES - REMOVED
 * 
 * Old flow: GET unsigned tx → SIGN → SUBMIT
 * 
 * ❌ WRONG architecture issues:
 * - /initiate endpoint tried to use Privacy Cash SDK incorrectly
 * - buildDepositTx() isn't proper SDK usage
 * - Manual tx building violates SDK architecture
 * 
 * ✅ NEW CORRECT FLOW:
 * - Frontend signs deposit tx directly with Phantom
 * - Frontend sends SIGNED tx to /api/links/:id/pay
 * - Server stores metadata (commitment, status)
 * - ZK proof handled by Privacy Cash SDK on blockchain
 * 
 * This file now just returns 410 Gone for backwards compatibility
 */

import express from "express"

const router = express.Router()

// Deprecated endpoints
router.post("/initiate", (req, res) => {
  res.status(410).json({
    error: "Gone - This endpoint is deprecated",
    message: "Use PayLink.tsx to sign transaction directly in browser",
    migrate: "POST /api/links/:id/pay with signedTx parameter"
  })
})

router.post("/submit", (req, res) => {
  res.status(410).json({
    error: "Gone - This endpoint is deprecated", 
    message: "Transaction submission is now handled by PayLink.tsx and /api/links/:id/pay",
    migrate: "POST /api/links/:id/pay with signedTx parameter"
  })
})

export default router
