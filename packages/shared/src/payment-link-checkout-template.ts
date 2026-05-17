/* eslint-disable max-lines */
/**
 * Shared renderer for Payment Link checkout page.
 * Generates full HTML using provided data so both server (SSR)
 * and admin preview can reuse the exact UI/UX implementation.
 */

export type PaymentLinkCheckoutCurrency = {
  currency: string;
  chains: string[];
  amount?: string | null;
  isPrimary?: boolean;
};

export interface PaymentLinkCheckoutData {
  title: string;
  description?: string | null;
  slug?: string | null;
  defaultAmount: string;
  currencies: PaymentLinkCheckoutCurrency[];
  shareUrl?: string | null;
  inventoryTotal?: number | null;
  inventoryReserved?: number | null;
  inventorySold?: number | null;
}

export interface PaymentLinkCheckoutRenderOptions {
  mode?: 'live' | 'preview';
  requestOrigin: string;
  apiBaseUrl: string;
  orderBaseUrl: string;
}

// Lucide icon SVGs
const ICONS = {
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  creditCard: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  network: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  mail: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="m22 7-10 5L2 7"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  xCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
};

const BASE_STYLES = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`;

const sanitize = (value: string | null | undefined): string =>
  value == null ? '' : String(value);

const formatChainName = (chainId: string) =>
  chainId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatAmountDisplay = (amount: string, currency: string) =>
  `${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} ${currency}`;

export const renderPaymentLinkCheckoutPage = (
  data: PaymentLinkCheckoutData,
  options: PaymentLinkCheckoutRenderOptions,
): string => {
  const mode = options.mode ?? 'live';

  const currencies = data.currencies && data.currencies.length > 0
    ? data.currencies
    : [{
        currency: data.defaultAmount ? (data.currencies[0]?.currency || data.shareUrl?.split('.').pop() || 'USDC') : 'USDC',
        chains: [],
        amount: data.defaultAmount,
        isPrimary: true,
      }];

  const primaryCurrency = currencies.find((c) => c.isPrimary) || currencies[0];
  const primaryCurrencySymbol = primaryCurrency?.currency || 'USDC';
  const primaryAmount = primaryCurrency?.amount ?? data.defaultAmount;
  const amountDisplay = formatAmountDisplay(primaryAmount || data.defaultAmount || '0', primaryCurrencySymbol);

  const currencyOptions = currencies
    .map((curr) => `<option value="${curr.currency}">${curr.currency}</option>`)
    .join('');

  const chainsByCurrency: Record<string, string[]> = {};
  currencies.forEach((curr) => {
    chainsByCurrency[curr.currency] = curr.chains || [];
  });

  const allChains = Array.from(new Set(currencies.flatMap((curr) => curr.chains || [])));
  const networksDescription = allChains.length > 0
    ? allChains.map((chain) => formatChainName(chain)).join(', ')
    : 'Multiple networks';

  const scriptConfig = {
    slug: data.slug || '__preview__',
    currencies: currencies.map((curr) => ({
      currency: curr.currency,
      amount: curr.amount ?? data.defaultAmount,
      chains: curr.chains || [],
      isPrimary: Boolean(curr.isPrimary),
    })),
    apiBase: options.apiBaseUrl.replace(/\/$/, ''),
    orderBaseUrl: options.orderBaseUrl.replace(/\/$/, ''),
    mode,
    amountDisplay,
  };

  const script = `
    (() => {
      const config = ${JSON.stringify(scriptConfig)};
      const form = document.getElementById('checkout-form');
      const emailInput = document.getElementById('email-input');
      const currencySelect = document.getElementById('currency-select');
      const chainSelect = document.getElementById('chain-select');
      const errorBox = document.getElementById('error-box');
      const loadingIndicator = document.getElementById('loading-indicator');
      const amountDisplay = document.getElementById('amount-display');

      const defaultCurrency = config.currencies.find((c) => c.isPrimary) || config.currencies[0];

      const chainsByCurrency = {};
      config.currencies.forEach((curr) => {
        chainsByCurrency[curr.currency] = curr.chains;
      });

      const showError = (message) => {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
      };

      const hideError = () => {
        if (!errorBox) return;
        errorBox.textContent = '';
        errorBox.classList.add('hidden');
      };

      const toggleLoading = (isLoading) => {
        if (!loadingIndicator) return;
        loadingIndicator.classList[isLoading ? 'remove' : 'add']('hidden');
      };

      const updateChainOptions = () => {
        const selectedCurrency = (currencySelect && currencySelect.value) || (defaultCurrency ? defaultCurrency.currency : '');
        const chains = selectedCurrency ? (chainsByCurrency[selectedCurrency] || []) : [];

        if (chainSelect) {
          chainSelect.innerHTML = chains
            .map((chain) => {
              const name = chain.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
              return \`<option value="\${chain}">\${name}</option>\`;
            })
            .join('');
        }

        const currencyConfig = config.currencies.find((c) => c.currency === selectedCurrency) || defaultCurrency;
        if (currencyConfig) {
          const formattedAmount = Number(currencyConfig.amount || defaultCurrency?.amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          });
          const displayText = \`\${formattedAmount} \${selectedCurrency}\`;

          // Update both desktop and mobile displays
          if (amountDisplay) {
            amountDisplay.textContent = displayText;
          }
          const mobileAmountDisplay = document.getElementById('mobile-amount-display');
          if (mobileAmountDisplay) {
            mobileAmountDisplay.textContent = displayText;
          }
        }
      };

      updateChainOptions();
      currencySelect?.addEventListener('change', updateChainOptions);

      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError();

        const email = emailInput?.value?.trim() || '';
        const currency = (currencySelect && currencySelect.value) || (defaultCurrency ? defaultCurrency.currency : '');
        const chainId = chainSelect?.value || '';

        if (!email) {
          showError('Email address is required so we can send you payment updates.');
          return;
        }

        if (!currency) {
          showError('Select a currency to continue.');
          return;
        }

        if (!chainId) {
          showError('Select a network to continue.');
          return;
        }

        if (config.mode === 'preview') {
          showError('Preview mode only – publishing required before buyers can pay.');
          return;
        }

        toggleLoading(true);

        try {
          const response = await fetch(
            \`\${config.apiBase}/api/payment-links/\${config.slug}/orders\`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, currency, chainId }),
            }
          );

          const payload = await response.json();

          if (!response.ok || !payload?.success) {
            const message = payload?.message || payload?.error || 'Failed to create payment order.';
            throw new Error(message);
          }

          const { order } = payload.data || {};
          const orderId = order?.orderId || order?.id;
          const targetUrl = orderId ? \`\${config.orderBaseUrl}/\${orderId}\` : null;

          if (targetUrl) {
            window.location.href = targetUrl;
            return;
          }

          showError('Order was created but redirect URL is missing. Please contact support.');
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
        } finally {
          toggleLoading(false);
        }
      });
    })();
  `;

  const showCurrencySelector = currencies.length > 1;
  const showChainSelector = allChains.length > 0;

  return [
    '<!DOCTYPE html>',
    '<html lang="en" class="dark">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${sanitize(data.title)} · PayIn Checkout</title>`,
    `<meta name="description" content="Secure checkout for ${sanitize(data.title)}." />`,
    ...(options.mode === 'preview'
      ? []
      : ['<link rel="stylesheet" href="/dist/assets/style.css" />']),
    `<style>${BASE_STYLES}</style>`,
    options.mode === 'preview'
      ? '<meta name="robots" content="noindex" />'
      : '',
    '</head>',
    '<body class="bg-background text-foreground min-h-screen">',

    // Header
    '<header class="border-b bg-card">',
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    '<div class="h-16 flex items-center justify-between">',
    '<div class="flex items-center gap-2">',
    '<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">',
    ICONS.shield,
    '</div>',
    '<span class="text-lg font-semibold">PayIn</span>',
    '</div>',
    '<div class="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">',
    '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>',
    '<span>Secure checkout</span>',
    '</div>',
    '</div>',
    '</div>',
    '</header>',

    // Main container with responsive layout
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">',
    '<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">',

    // Left column - Order Summary (Desktop: sticky, Mobile: collapsible)
    '<div class="lg:col-span-5">',
    '<div class="lg:sticky lg:top-8">',

    // Mobile collapsible summary
    '<button type="button" onclick="this.nextElementSibling.classList.toggle(\'hidden\')" class="lg:hidden w-full flex items-center justify-between p-4 bg-card border rounded-lg mb-4">',
    '<div class="flex items-center gap-3">',
    '<span class="text-sm font-medium text-muted-foreground">Order summary</span>',
    `<span class="text-lg font-bold" id="mobile-amount-display">${amountDisplay}</span>`,
    '</div>',
    '<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>',
    '</button>',

    // Order summary content
    '<div class="hidden lg:block bg-card border rounded-xl p-6 lg:p-8">',

    // Status badge (preview mode only)
    mode === 'preview'
      ? '<div class="mb-4"><span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium"><span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>Preview Mode</span></div>'
      : '',

    // Product info
    '<div class="mb-6">',
    '<h1 class="text-2xl font-bold mb-2">' + sanitize(data.title) + '</h1>',
    data.description
      ? '<p class="text-sm text-muted-foreground leading-relaxed">' + sanitize(data.description) + '</p>'
      : '',
    '</div>',

    // Amount section - prominent display
    '<div class="py-6 border-t border-b">',
    '<div class="flex items-baseline justify-between mb-2">',
    '<span class="text-sm text-muted-foreground">Amount due</span>',
    '</div>',
    '<div class="flex items-baseline gap-2">',
    '<span class="text-4xl lg:text-5xl font-bold tracking-tight" id="amount-display">' + amountDisplay + '</span>',
    '</div>',
    '</div>',

    // Additional details
    '<div class="mt-6 space-y-4">',
    '<div class="flex gap-3">',
    '<div class="mt-0.5 text-muted-foreground">' + ICONS.network + '</div>',
    '<div class="flex-1 min-w-0">',
    '<div class="text-sm font-medium mb-1">Supported networks</div>',
    '<div class="text-sm text-muted-foreground">' + sanitize(networksDescription) + '</div>',
    '</div>',
    '</div>',
    data.shareUrl
      ? '<div class="flex gap-3"><div class="mt-0.5 text-muted-foreground">' + ICONS.link + '</div><div class="flex-1 min-w-0"><div class="text-sm font-medium mb-1">Payment link</div><a href="' + sanitize(data.shareUrl) + '" target="_blank" class="text-sm text-primary hover:underline break-all">' + sanitize(data.shareUrl) + '</a></div></div>'
      : '',
    '</div>',

    // Trust badges
    '<div class="mt-8 pt-6 border-t space-y-3">',
    '<div class="flex items-center gap-2 text-sm text-muted-foreground">',
    '<svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    '<span>Secure blockchain payment</span>',
    '</div>',
    '<div class="flex items-center gap-2 text-sm text-muted-foreground">',
    '<svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    '<span>No hidden fees</span>',
    '</div>',
    '<div class="flex items-center gap-2 text-sm text-muted-foreground">',
    '<svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    '<span>Instant confirmation</span>',
    '</div>',
    '</div>',

    '</div>',
    '</div>',
    '</div>',

    // Right column - Payment Form
    '<div class="lg:col-span-7">',
    '<div class="bg-card border rounded-xl p-6 lg:p-8">',

    '<h2 class="text-xl font-semibold mb-6">Payment details</h2>',

    '<form id="checkout-form" class="space-y-6">',

    // Email field
    '<div>',
    '<label for="email-input" class="block text-sm font-medium mb-2">',
    'Email',
    '</label>',
    '<input',
    '  id="email-input"',
    '  name="email"',
    '  type="email"',
    '  required',
    '  placeholder="you@example.com"',
    '  class="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"',
    '/>',
    '<p class="mt-2 text-xs text-muted-foreground">Payment confirmation will be sent to this address</p>',
    '</div>',

    // Currency selector (if multiple)
    showCurrencySelector
      ? '<div><label for="currency-select" class="block text-sm font-medium mb-2">Currency</label><select id="currency-select" name="currency" required class="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors">' + currencyOptions + '</select><p class="mt-2 text-xs text-muted-foreground">Choose your preferred stablecoin</p></div>'
      : '',

    // Chain selector
    showChainSelector
      ? '<div><label for="chain-select" class="block text-sm font-medium mb-2">Network</label><select id="chain-select" name="chainId" required class="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"></select><p class="mt-2 text-xs text-muted-foreground">Select the blockchain network for your transaction</p></div>'
      : '<div><label class="block text-sm font-medium mb-2">Network</label><input value="No networks configured" disabled class="w-full h-12 px-4 text-base bg-muted border border-input rounded-lg opacity-50 cursor-not-allowed" /></div>',

    // Submit button
    '<div class="pt-4">',
    '<button',
    '  type="submit"',
    `  class="w-full h-12 px-6 text-base font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"`,
    mode === 'preview' ? '  disabled' : '',
    '>',
    mode === 'preview' ? 'Preview Mode - Cannot Submit' : 'Continue to payment',
    '</button>',
    '</div>',

    // Error message
    '<div id="error-box" class="hidden p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"></div>',

    // Loading indicator
    '<div id="loading-indicator" class="hidden text-center">',
    '<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">',
    '<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>',
    '<span>Processing...</span>',
    '</div>',
    '</div>',

    '</form>',

    // Terms
    '<div class="mt-6 pt-6 border-t">',
    '<p class="text-xs text-center text-muted-foreground">',
    'By continuing, you agree to our terms of service. All cryptocurrency transactions are final and non-refundable.',
    '</p>',
    '</div>',

    '</div>',
    '</div>',

    '</div>',
    '</div>',

    // Footer
    '<footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12 border-t">',
    '<div class="text-center text-sm text-muted-foreground">',
    '<span>Powered by </span>',
    '<span class="font-medium text-foreground">PayIn</span>',
    '<span> · Secure cryptocurrency payments</span>',
    '</div>',
    '</footer>',

    `<script>${script}</script>`,
    '</body>',
    '</html>',
  ].join('');
};
