#!/bin/bash

# Relayer SOL Balance Fix Script
# Run this to add SOL to relayer for transaction fees

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   RELAYER SOL BALANCE FIX${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if relayer is running
echo -e "${YELLOW}Checking relayer status...${NC}"
RELAYER_URL="https://shadowpay-production-8362.up.railway.app"

HEALTH=$(curl -s "$RELAYER_URL/health" 2>/dev/null)
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Relayer not reachable at $RELAYER_URL${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Relayer is running${NC}"
echo ""

# Extract relayer public key from health response
RELAYER_PUBKEY=$(echo "$HEALTH" | grep -o '"relayerPublicKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$RELAYER_PUBKEY" ]; then
  echo -e "${RED}❌ Could not find relayer public key${NC}"
  echo -e "${YELLOW}Health response:${NC}"
  echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
  exit 1
fi

echo -e "${GREEN}📍 Relayer Address:${NC}"
echo "   $RELAYER_PUBKEY"
echo ""

# Check current balance
echo -e "${YELLOW}Checking current SOL balance...${NC}"
BALANCE=$(curl -s "https://api.mainnet-beta.solana.com" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$RELAYER_PUBKEY\"]}" \
  | jq -r '.result.value')

BALANCE_SOL=$(echo "scale=9; $BALANCE / 1000000000" | bc)

echo -e "${GREEN}💰 Current Balance: ${BALANCE_SOL} SOL${NC}"
echo ""

# Check if balance is sufficient
MIN_BALANCE=0.01
if (( $(echo "$BALANCE_SOL < $MIN_BALANCE" | bc -l) )); then
  echo -e "${RED}❌ CRITICAL: Balance too low!${NC}"
  echo -e "${RED}   Minimum required: 0.01 SOL${NC}"
  echo -e "${RED}   Current: $BALANCE_SOL SOL${NC}"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}   ACTION REQUIRED${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${GREEN}1. Send SOL to relayer address:${NC}"
  echo "   $RELAYER_PUBKEY"
  echo ""
  echo -e "${GREEN}2. Recommended amount: 0.1 SOL${NC}"
  echo "   (enough for ~1000 transactions)"
  echo ""
  echo -e "${GREEN}3. After sending, restart relayer:${NC}"
  echo "   railway restart --service relayer"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Balance is sufficient for transactions${NC}"
  
  if (( $(echo "$BALANCE_SOL < 0.1" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Warning: Balance is low${NC}"
    echo -e "${YELLOW}   Consider adding more SOL for buffer${NC}"
  fi
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Relayer SOL balance check complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
