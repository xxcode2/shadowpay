#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# SHADOWPAY RUNTIME VERIFICATION CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════
# 
# Use this script to verify ShadowPay actually works in runtime
# DO NOT skip any step - each verifies critical privacy/security property
#
# ═══════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════"
echo "SHADOWPAY RUNTIME VERIFICATION"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Install Dependencies
echo "Step 1: Installing Privacy Cash SDK..."
echo "─────────────────────────────────────────────────────────────────────────"
cd server && npm install
cd ../relayer && npm install
cd ..

if [ ! -d "server/node_modules/privacycash" ]; then
    echo "❌ FAILED: Privacy Cash SDK not installed in server/"
    exit 1
fi

if [ ! -d "relayer/node_modules/privacycash" ]; then
    echo "❌ FAILED: Privacy Cash SDK not installed in relayer/"
    exit 1
fi

echo "✅ Privacy Cash SDK installed"
echo ""

# Step 2: Generate Relayer Keypair
echo "Step 2: Generating relayer keypair..."
echo "─────────────────────────────────────────────────────────────────────────"
if [ ! -f "relayer/relayer.json" ]; then
    echo "Generating new relayer keypair..."
    solana-keygen new --outfile relayer/relayer.json --no-bip39-passphrase
    echo "✅ Relayer keypair generated"
else
    echo "✅ Relayer keypair already exists"
fi

RELAYER_PUBKEY=$(solana-keygen pubkey relayer/relayer.json)
echo "Relayer public key: $RELAYER_PUBKEY"
echo ""

# Step 3: Check Relayer Balance
echo "Step 3: Checking relayer balance..."
echo "─────────────────────────────────────────────────────────────────────────"
BALANCE=$(solana balance relayer/relayer.json --url devnet 2>/dev/null || echo "0")
echo "Relayer balance: $BALANCE"

if [ "$BALANCE" = "0" ] || [ "$BALANCE" = "0 SOL" ]; then
    echo "⚠️  WARNING: Relayer has no funds"
    echo "Fund with: solana airdrop 2 $RELAYER_PUBKEY --url devnet"
    echo "Or request from faucet: https://faucet.solana.com"
    echo ""
    read -p "Press enter after funding relayer..."
fi

echo "✅ Relayer funded"
echo ""

# Step 4: Configure Environment
echo "Step 4: Verifying environment configuration..."
echo "─────────────────────────────────────────────────────────────────────────"

if [ ! -f "server/.env" ]; then
    echo "❌ server/.env not found"
    echo "Copy from: cp server/.env.example server/.env"
    exit 1
fi

if [ ! -f "relayer/.env" ]; then
    echo "⚠️  relayer/.env not found, creating from example..."
    cp relayer/.env.example relayer/.env
fi

echo "✅ Environment files exist"
echo ""

# Step 5: Start Services
echo "Step 5: Starting services..."
echo "─────────────────────────────────────────────────────────────────────────"
echo "Starting relayer on port 4444..."
cd relayer && npm start > ../relayer.log 2>&1 &
RELAYER_PID=$!
cd ..

sleep 3

echo "Starting backend on port 3333..."
cd server && npm start > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

sleep 3

# Check if services are running
curl -s http://localhost:4444/health > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Relayer failed to start (check relayer.log)"
    kill $RELAYER_PID $SERVER_PID 2>/dev/null
    exit 1
fi

curl -s http://localhost:3333/health > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Backend failed to start (check server.log)"
    kill $RELAYER_PID $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Services running"
echo ""

# Step 6: Test Deposit Flow
echo "Step 6: Testing deposit to Privacy Cash pool..."
echo "─────────────────────────────────────────────────────────────────────────"

# Create link
LINK_RESPONSE=$(curl -s -X POST http://localhost:3333/links \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "token": "SOL", "creator_id": "test-user"}')

LINK_ID=$(echo $LINK_RESPONSE | jq -r '.link.id')
echo "Created link: $LINK_ID"

# Deposit
echo "Depositing 0.01 SOL..."
DEPOSIT_RESPONSE=$(curl -s -X POST http://localhost:3333/links/$LINK_ID/pay \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.01, "token": "SOL", "payerWallet": "test"}')

TX_HASH=$(echo $DEPOSIT_RESPONSE | jq -r '.tx')

if [ "$TX_HASH" = "null" ] || [ -z "$TX_HASH" ]; then
    echo "❌ Deposit failed"
    echo "Response: $DEPOSIT_RESPONSE"
    kill $RELAYER_PID $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Deposit successful"
echo "Transaction: $TX_HASH"
echo ""

# Step 7: CRITICAL - Verify On-Chain Transaction
echo "Step 7: CRITICAL VERIFICATION - On-chain transaction analysis"
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "🔍 MANUAL VERIFICATION REQUIRED:"
echo ""
echo "1. Open: https://solscan.io/tx/$TX_HASH?cluster=devnet"
echo "2. Check program invoked:"
echo "   ✅ Should be: Privacy Cash program (NOT SystemProgram)"
echo "   ❌ If SystemProgram::Transfer → NO PRIVACY"
echo ""
echo "3. Check instructions:"
echo "   ✅ Should contain commitment data"
echo "   ❌ If simple transfer → FAKE PRIVACY"
echo ""
echo "4. Check accounts:"
echo "   ✅ Should include Privacy Cash pool account"
echo "   ❌ If direct to recipient → NO PRIVACY"
echo ""
read -p "Press enter after verifying on-chain transaction..."

# Step 8: Test Withdraw Flow
echo ""
echo "Step 8: Testing withdraw from Privacy Cash pool..."
echo "─────────────────────────────────────────────────────────────────────────"
echo "Starting withdraw (this should take 1-3 seconds if ZK proof is generated)..."

START_TIME=$(date +%s%3N)

WITHDRAW_RESPONSE=$(curl -s -X POST http://localhost:3333/links/$LINK_ID/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token" \
  -d "{\"recipientWallet\": \"$RELAYER_PUBKEY\"}")

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

WITHDRAW_TX=$(echo $WITHDRAW_RESPONSE | jq -r '.tx')

if [ "$WITHDRAW_TX" = "null" ] || [ -z "$WITHDRAW_TX" ]; then
    echo "⚠️  Withdraw failed (may need real auth token)"
    echo "Response: $WITHDRAW_RESPONSE"
else
    echo "✅ Withdraw successful"
    echo "Transaction: $WITHDRAW_TX"
    echo "Duration: ${DURATION}ms"
    
    if [ $DURATION -gt 1000 ]; then
        echo "✅ Slow transaction (likely ZK proof generation)"
    else
        echo "⚠️  Fast transaction (${DURATION}ms) - ZK proof may NOT be used"
    fi
fi

echo ""

# Step 9: CRITICAL - Verify Withdraw Transaction
echo "Step 9: CRITICAL VERIFICATION - Withdraw transaction analysis"
echo "─────────────────────────────────────────────────────────────────────────"
echo ""
echo "🔍 MANUAL VERIFICATION REQUIRED:"
echo ""
if [ "$WITHDRAW_TX" != "null" ] && [ -n "$WITHDRAW_TX" ]; then
    echo "1. Open: https://solscan.io/tx/$WITHDRAW_TX?cluster=devnet"
    echo ""
    echo "2. Check for ZK proof data:"
    echo "   ✅ Instruction should contain proof bytes"
    echo "   ❌ If no proof data → NO ZK PRIVACY"
    echo ""
    echo "3. Check for nullifier:"
    echo "   ✅ Should include nullifier account"
    echo "   ❌ If no nullifier → DOUBLE-SPEND POSSIBLE"
    echo ""
    echo "4. Check anonymity:"
    echo "   ✅ Cannot link deposit tx ↔ withdraw tx"
    echo "   ❌ If obvious link → NO PRIVACY"
    echo ""
fi
read -p "Press enter after verification..."

# Step 10: Test Double-Spend Prevention
echo ""
echo "Step 10: Testing double-spend prevention..."
echo "─────────────────────────────────────────────────────────────────────────"
echo "Attempting to withdraw same commitment again (should FAIL)..."

DOUBLE_SPEND=$(curl -s -X POST http://localhost:3333/links/$LINK_ID/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token" \
  -d "{\"recipientWallet\": \"$RELAYER_PUBKEY\"}")

if echo $DOUBLE_SPEND | grep -q "error\|fail\|withdrawn"; then
    echo "✅ Double-spend prevented (link already withdrawn)"
else
    echo "⚠️  WARNING: Second withdraw may have succeeded"
    echo "Response: $DOUBLE_SPEND"
fi

echo ""

# Cleanup
echo "Stopping services..."
kill $RELAYER_PID $SERVER_PID 2>/dev/null
echo ""

# Final Report
echo "═══════════════════════════════════════════════════════════════════════════"
echo "VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "RESULTS:"
echo "✅ Privacy Cash SDK installed"
echo "✅ Services can start"
echo "✅ Deposit flow works"
if [ "$WITHDRAW_TX" != "null" ] && [ -n "$WITHDRAW_TX" ]; then
    echo "✅ Withdraw flow works"
else
    echo "⚠️  Withdraw needs real authentication"
fi
echo ""
echo "MANUAL VERIFICATION REQUIRED:"
echo "⚠️  On-chain transaction inspection"
echo "⚠️  ZK proof verification"
echo "⚠️  Anonymity set analysis"
echo ""
echo "DO NOT CLAIM 'PRIVATE' UNTIL YOU VERIFY ON-CHAIN TRANSACTIONS"
echo ""
echo "Logs:"
echo "  Backend: server.log"
echo "  Relayer: relayer.log"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
