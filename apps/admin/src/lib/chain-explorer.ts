/**
 * Chain Explorer URL utilities
 * Maps chain IDs to their respective blockchain explorer URLs
 */

interface ExplorerConfig {
  name: string;
  urlTemplate: string; // Template with {address} placeholder
}

/**
 * Chain explorer configurations
 * Maps chain ID to explorer config
 */
const CHAIN_EXPLORERS: Record<string, ExplorerConfig> = {
  // EVM chains
  'ethereum-mainnet': {
    name: 'Etherscan',
    urlTemplate: 'https://etherscan.io/address/{address}',
  },
  'ethereum-sepolia': {
    name: 'Sepolia Etherscan',
    urlTemplate: 'https://sepolia.etherscan.io/address/{address}',
  },
  'polygon-mainnet': {
    name: 'PolygonScan',
    urlTemplate: 'https://polygonscan.com/address/{address}',
  },
  'polygon-amoy': {
    name: 'Amoy PolygonScan',
    urlTemplate: 'https://amoy.polygonscan.com/address/{address}',
  },
  'base-mainnet': {
    name: 'BaseScan',
    urlTemplate: 'https://basescan.org/address/{address}',
  },
  'base-sepolia': {
    name: 'Sepolia BaseScan',
    urlTemplate: 'https://sepolia.basescan.org/address/{address}',
  },
  'arbitrum-mainnet': {
    name: 'Arbiscan',
    urlTemplate: 'https://arbiscan.io/address/{address}',
  },
  'arbitrum-sepolia': {
    name: 'Sepolia Arbiscan',
    urlTemplate: 'https://sepolia.arbiscan.io/address/{address}',
  },
  'optimism-mainnet': {
    name: 'Optimism Etherscan',
    urlTemplate: 'https://optimistic.etherscan.io/address/{address}',
  },
  'optimism-sepolia': {
    name: 'Sepolia Optimism Etherscan',
    urlTemplate: 'https://sepolia-optimism.etherscan.io/address/{address}',
  },

  // Tron chains
  'tron-mainnet': {
    name: 'Tronscan',
    urlTemplate: 'https://tronscan.org/#/address/{address}',
  },
  'tron-nile': {
    name: 'Nile Tronscan',
    urlTemplate: 'https://nile.tronscan.org/#/address/{address}',
  },
  'tron-shasta': {
    name: 'Shasta Tronscan',
    urlTemplate: 'https://shasta.tronscan.org/#/address/{address}',
  },

  // Solana chains
  'solana-mainnet': {
    name: 'Solana Explorer',
    urlTemplate: 'https://explorer.solana.com/address/{address}',
  },
  'solana-devnet': {
    name: 'Solana Devnet Explorer',
    urlTemplate: 'https://explorer.solana.com/address/{address}?cluster=devnet',
  },
  'solana-testnet': {
    name: 'Solana Testnet Explorer',
    urlTemplate: 'https://explorer.solana.com/address/{address}?cluster=testnet',
  },

  // X Layer chains
  'xlayer-mainnet': {
    name: 'OKLink X Layer',
    urlTemplate: 'https://www.oklink.com/xlayer/address/{address}',
  },
  'xlayer-testnet': {
    name: 'OKLink X Layer Testnet',
    urlTemplate: 'https://www.oklink.com/xlayer-test/address/{address}',
  },
};

/**
 * Get explorer URL for a specific chain and address
 */
export function getExplorerUrl(chainId: string, address: string): string | null {
  const config = CHAIN_EXPLORERS[chainId];
  if (!config) return null;

  return config.urlTemplate.replace('{address}', address);
}

/**
 * Get explorer config for a specific chain
 */
export function getExplorerConfig(chainId: string): ExplorerConfig | null {
  return CHAIN_EXPLORERS[chainId] || null;
}

/**
 * Get all explorer URLs for a protocol and address
 * For EVM addresses, this returns explorers for all EVM chains
 * For Tron/Solana, returns only the relevant chain explorers
 */
export function getExplorerUrlsForProtocol(
  protocol: 'evm' | 'tron' | 'solana',
  address: string,
  availableChains?: Array<{ chainId: string; protocol: string; name: string }>
): Array<{ chainId: string; chainName: string; explorerName: string; url: string }> {
  const results: Array<{ chainId: string; chainName: string; explorerName: string; url: string }> = [];

  // If availableChains is provided, use it to filter
  const chainsToCheck = availableChains
    ? availableChains.filter((chain) => chain.protocol === protocol)
    : Object.entries(CHAIN_EXPLORERS)
        .filter(([chainId]) => {
          // Simple protocol detection based on chain ID prefix
          if (protocol === 'evm') {
            return (
              chainId.startsWith('ethereum-') ||
              chainId.startsWith('polygon-') ||
              chainId.startsWith('base-') ||
              chainId.startsWith('arbitrum-') ||
              chainId.startsWith('optimism-') ||
              chainId.startsWith('xlayer-')
            );
          } else if (protocol === 'tron') {
            return chainId.startsWith('tron-');
          } else if (protocol === 'solana') {
            return chainId.startsWith('solana-');
          }
          return false;
        })
        .map(([chainId]) => ({ chainId, protocol, name: chainId }));

  for (const chain of chainsToCheck) {
    const config = getExplorerConfig(chain.chainId);
    if (config) {
      results.push({
        chainId: chain.chainId,
        chainName: chain.name || chain.chainId,
        explorerName: config.name,
        url: getExplorerUrl(chain.chainId, address)!,
      });
    }
  }

  return results;
}
