#!/bin/bash

# ShadowPay Build Script
# Sets environment variables for Vite build based on deployment target

# Detect environment
if [ -z "$VITE_API_URL" ]; then
  # If not set, use production defaults
  export VITE_API_URL="https://shadowpay-production.up.railway.app/api"
fi

if [ -z "$VITE_SOLANA_NETWORK" ]; then
  export VITE_SOLANA_NETWORK="mainnet"
fi

echo "🔨 Building ShadowPay..."
echo "  API_URL: $VITE_API_URL"
echo "  SOLANA_NETWORK: $VITE_SOLANA_NETWORK"

# Run the build
npm run build
