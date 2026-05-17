/**
 * Time utility functions for handling timestamps from API
 *
 * IMPORTANT: The pg library automatically converts PostgreSQL timestamps to JavaScript Date objects.
 * These Date objects are already correctly representing UTC time in the local timezone.
 * We just need to handle both Date objects and string formats that might come from the API.
 */

/**
 * Parse a timestamp to a Date object
 * Handles Date objects, ISO strings, and PostgreSQL format strings
 *
 * @param input - Timestamp from API (Date object or string)
 * @returns Date object
 */
export function parseTimestamp(input: Date | string | null | undefined): Date | null {
  if (!input) return null;

  // If already a Date object, return it directly
  if (input instanceof Date) {
    return input;
  }

  // If it's a string, parse it
  // The API should return ISO strings with 'Z' or Date objects
  return new Date(input);
}

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 *
 * @param input - Timestamp from API (Date object or string)
 * @returns Formatted relative time string
 */
export function formatRelativeTime(input: Date | string | null | undefined): string {
  const date = parseTimestamp(input);
  if (!date || isNaN(date.getTime())) return '-';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp as absolute time (e.g., "Oct 10, 2025, 10:30 AM")
 *
 * @param input - Timestamp from API (Date object or string)
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted time string
 */
export function formatAbsoluteTime(
  input: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseTimestamp(input);
  if (!date || isNaN(date.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return date.toLocaleString('en-US', options || defaultOptions);
}

/**
 * Format date only (e.g., "Oct 10, 2025")
 *
 * @param input - Timestamp from API (Date object or string)
 * @returns Formatted date string
 */
export function formatDate(input: Date | string | null | undefined): string {
  const date = parseTimestamp(input);
  if (!date || isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get block explorer URL for a transaction
 *
 * @param chain - Chain identifier (e.g., "ethereum-sepolia", "polygon-amoy")
 * @param txHash - Transaction hash
 * @returns Block explorer URL
 */
export function getExplorerUrl(chain: string, txHash: string): string {
  const explorers: Record<string, string> = {
    'ethereum-sepolia': 'https://sepolia.etherscan.io/tx',
    'ethereum-mainnet': 'https://etherscan.io/tx',
    'polygon-amoy': 'https://amoy.polygonscan.com/tx',
    'polygon-mainnet': 'https://polygonscan.com/tx',
    'tron-mainnet': 'https://tronscan.org/#/transaction',
    'tron-shasta': 'https://shasta.tronscan.org/#/transaction',
    'tron-nile': 'https://nile.tronscan.org/#/transaction',
    'solana-mainnet': 'https://explorer.solana.com/tx',
    'solana-devnet': 'https://explorer.solana.com/tx',
    'arbitrum-mainnet': 'https://arbiscan.io/tx',
    'arbitrum-sepolia': 'https://sepolia.arbiscan.io/tx',
    'xlayer-mainnet': 'https://www.oklink.com/xlayer/tx',
    'xlayer-testnet': 'https://www.oklink.com/xlayer-test/tx',
  };

  const baseUrl = explorers[chain] || explorers['ethereum-sepolia'];
  return `${baseUrl}/${txHash}`;
}

/**
 * Get block explorer URL for an address
 *
 * @param chain - Chain identifier
 * @param address - Wallet address
 * @returns Block explorer URL
 */
export function getAddressExplorerUrl(chain: string, address: string): string {
  const explorers: Record<string, string> = {
    'ethereum-sepolia': 'https://sepolia.etherscan.io/address',
    'ethereum-mainnet': 'https://etherscan.io/address',
    'polygon-amoy': 'https://amoy.polygonscan.com/address',
    'polygon-mainnet': 'https://polygonscan.com/address',
    'tron-mainnet': 'https://tronscan.org/#/address',
    'tron-shasta': 'https://shasta.tronscan.org/#/address',
    'tron-nile': 'https://nile.tronscan.org/#/address',
    'solana-mainnet': 'https://explorer.solana.com/address',
    'solana-devnet': 'https://explorer.solana.com/address',
    'arbitrum-mainnet': 'https://arbiscan.io/address',
    'arbitrum-sepolia': 'https://sepolia.arbiscan.io/address',
    'xlayer-mainnet': 'https://www.oklink.com/xlayer/address',
    'xlayer-testnet': 'https://www.oklink.com/xlayer-test/address',
  };

  const baseUrl = explorers[chain] || explorers['ethereum-sepolia'];
  return `${baseUrl}/${address}`;
}
