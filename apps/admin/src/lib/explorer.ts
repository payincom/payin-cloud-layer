/**
 * Blockchain Explorer Utilities
 * Functions for generating blockchain explorer URLs
 */

/**
 * Get block explorer URL for a transaction or address
 *
 * @param chain - Chain identifier (e.g., "ethereum-sepolia", "polygon-amoy", "tron-nile")
 * @param hash - Transaction hash or address
 * @param type - URL type: 'tx' for transaction, 'address' for address
 * @returns Block explorer URL
 */
export function getExplorerUrl(
  chain: string,
  hash: string,
  type: 'tx' | 'address' = 'tx'
): string {
  const explorers: Record<string, { tx: string; address: string }> = {
    'ethereum-sepolia': {
      tx: 'https://sepolia.etherscan.io/tx',
      address: 'https://sepolia.etherscan.io/address',
    },
    'ethereum-mainnet': {
      tx: 'https://etherscan.io/tx',
      address: 'https://etherscan.io/address',
    },
    'polygon-amoy': {
      tx: 'https://amoy.polygonscan.com/tx',
      address: 'https://amoy.polygonscan.com/address',
    },
    'polygon-mainnet': {
      tx: 'https://polygonscan.com/tx',
      address: 'https://polygonscan.com/address',
    },
    'tron-mainnet': {
      tx: 'https://tronscan.org/#/transaction',
      address: 'https://tronscan.org/#/address',
    },
    'tron-shasta': {
      tx: 'https://shasta.tronscan.org/#/transaction',
      address: 'https://shasta.tronscan.org/#/address',
    },
    'tron-nile': {
      tx: 'https://nile.tronscan.org/#/transaction',
      address: 'https://nile.tronscan.org/#/address',
    },
    'solana-mainnet': {
      tx: 'https://explorer.solana.com/tx',
      address: 'https://explorer.solana.com/address',
    },
    'solana-devnet': {
      tx: 'https://explorer.solana.com/tx',
      address: 'https://explorer.solana.com/address',
    },
    'arbitrum-mainnet': {
      tx: 'https://arbiscan.io/tx',
      address: 'https://arbiscan.io/address',
    },
    'arbitrum-sepolia': {
      tx: 'https://sepolia.arbiscan.io/tx',
      address: 'https://sepolia.arbiscan.io/address',
    },
    'xlayer-mainnet': {
      tx: 'https://www.oklink.com/xlayer/tx',
      address: 'https://www.oklink.com/xlayer/address',
    },
    'xlayer-testnet': {
      tx: 'https://www.oklink.com/xlayer-test/tx',
      address: 'https://www.oklink.com/xlayer-test/address',
    },
  };

  const chainExplorers = explorers[chain] || explorers['ethereum-sepolia'];
  const baseUrl = chainExplorers[type];
  return `${baseUrl}/${hash}`;
}

/**
 * Get transaction explorer URL
 *
 * @param chain - Chain identifier
 * @param txHash - Transaction hash
 * @returns Block explorer URL for transaction
 */
export function getTxExplorerUrl(chain: string, txHash: string): string {
  return getExplorerUrl(chain, txHash, 'tx');
}

/**
 * Get address explorer URL
 *
 * @param chain - Chain identifier
 * @param address - Wallet address
 * @returns Block explorer URL for address
 */
export function getAddressExplorerUrl(chain: string, address: string): string {
  return getExplorerUrl(chain, address, 'address');
}
