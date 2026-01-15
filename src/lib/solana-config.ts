/**
 * Solana Network Configuration
 * Support for devnet, testnet, and mainnet
 */

export const NETWORKS = {
  devnet: {
    name: "Solana Devnet",
    rpcUrl: "https://api.devnet.solana.com",
    wsUrl: "wss://api.devnet.solana.com",
    explorerUrl: "https://explorer.solana.com",
    symbol: "DEVNET",
  },
  testnet: {
    name: "Solana Testnet",
    rpcUrl: "https://api.testnet.solana.com",
    wsUrl: "wss://api.testnet.solana.com",
    explorerUrl: "https://explorer.solana.com",
    symbol: "TESTNET",
  },
  mainnet: {
    name: "Solana Mainnet",
    rpcUrl: "https://mainnet.helius-rpc.com/?api-key=c455719c-354b-4a44-98d4-27f8a18aa79c",
    wsUrl: "wss://api.mainnet-beta.solana.com",
    explorerUrl: "https://explorer.solana.com",
    symbol: "MAINNET",
  },
} as const;

export type NetworkType = keyof typeof NETWORKS;

export const CURRENT_NETWORK: NetworkType = (
  import.meta.env.VITE_SOLANA_NETWORK || "testnet"
) as NetworkType;

export const CURRENT_RPC = NETWORKS[CURRENT_NETWORK].rpcUrl;
export const CURRENT_WS = NETWORKS[CURRENT_NETWORK].wsUrl;
export const CURRENT_EXPLORER = NETWORKS[CURRENT_NETWORK].explorerUrl;
export const NETWORK_NAME = NETWORKS[CURRENT_NETWORK].name;

/**
 * Token addresses on Solana testnet
 */
export const TOKENS = {
  SOL: {
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    mint: null, // Native SOL
  },
  USDC: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
    mint: "EPjFWaLb3odcccccccccccccccccccccccccccccccc", // Mainnet
    testnetMint: "4zMMC9srt5Ri5X14niQT69nsH+kP6xvFkMscL86yQ54=", // Devnet USDC
  },
  USDT: {
    name: "Tether",
    symbol: "USDT",
    decimals: 6,
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEsl", // Mainnet
    testnetMint: null,
  },
} as const;

/**
 * Get token mint address for current network
 */
export function getTokenMint(symbol: "SOL" | "USDC" | "USDT"): string | null {
  if (symbol === "SOL") return null; // Native SOL
  
  const token = TOKENS[symbol];
  if (!token) return null;
  
  if (CURRENT_NETWORK !== "mainnet" && symbol === "USDC") {
    return token.testnetMint;
  }
  
  return token.mint;
}

/**
 * Get token decimals
 */
export function getTokenDecimals(symbol: "SOL" | "USDC" | "USDT"): number {
  return TOKENS[symbol]?.decimals || 6;
}

/**
 * Format Solana explorer URL for transaction
 */
export function getSolscanUrl(txHash: string, path = "tx"): string {
  const cluster =
    CURRENT_NETWORK === "mainnet" ? "" : `?cluster=${CURRENT_NETWORK}`;
  return `${CURRENT_EXPLORER}/${path}/${txHash}${cluster}`;
}

/**
 * Get Phantom wallet network configuration
 */
export function getPhantomNetworkConfig() {
  const networkMap = {
    devnet: "devnet",
    testnet: "testnet",
    mainnet: "mainnet-beta",
  };
  
  return networkMap[CURRENT_NETWORK];
}
