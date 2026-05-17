/* eslint-disable max-lines */
/**
 * Payment Link checkout page React component.
 * All Tailwind classes in JSX will be automatically scanned by Tailwind.
 */
import React from 'react';
import { PaymentLayout } from './components/PaymentLayout.js';
import { OrderSummary } from './components/OrderSummary.js';

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
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

export interface PaymentLinkCheckoutRenderOptions {
  mode?: 'live' | 'preview';
  previewViewport?: 'desktop' | 'mobile';
  requestOrigin: string;
  apiBaseUrl: string;
  orderBaseUrl: string;
}

export interface CheckoutPageProps {
  data: PaymentLinkCheckoutData;
  options: PaymentLinkCheckoutRenderOptions;
}

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

/**
 * Checkout page React component.
 * All Tailwind classes will be automatically scanned.
 */
export function CheckoutPage({ data, options }: CheckoutPageProps) {
  const mode = options.mode ?? 'live';
  const previewViewport = options.previewViewport ?? 'desktop';
  const amountType = data.amountType ?? 'fixed';
  const ctaText = data.ctaText || 'Continue to payment';
  const theme = data.theme ?? 'dark';
  const showAmountInput = amountType === 'user_input';

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
  const amountDisplay = amountType === 'user_input'
    ? 'Custom Amount'
    : formatAmountDisplay(primaryAmount || data.defaultAmount || '0', primaryCurrencySymbol);

  const allChains = Array.from(new Set(currencies.flatMap((curr) => curr.chains || [])));
  const networksDescription = allChains.length > 0
    ? allChains.map((chain) => formatChainName(chain)).join(', ')
    : 'Multiple networks';

  const showCurrencySelector = currencies.length > 1;
  const showChainSelector = allChains.length > 0;

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
    amountType,
    ctaText,
    defaultAmount: data.defaultAmount,
    theme,
    title: data.title,
    description: data.description ?? null,
    shareUrl: data.shareUrl ?? null,
  };

  const baseStyles = `
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

  const inlineScript = `
    (() => {
      const config = ${JSON.stringify(scriptConfig)};
      const form = document.getElementById('checkout-form');
      const emailInput = document.getElementById('email-input');
      const amountInput = document.getElementById('amount-input');
      const currencySelect = document.getElementById('currency-select');
      const chainSelect = document.getElementById('chain-select');
      const errorBox = document.getElementById('error-box');
      const loadingIndicator = document.getElementById('loading-indicator');
      const amountDisplay = document.getElementById('amount-display');
      const amountInputSection = document.getElementById('amount-input-section');
      const mobileAmountDisplay = document.getElementById('mobile-amount-display');
      const summaryTitle = document.getElementById('summary-title');
      const summaryDescription = document.getElementById('summary-description');
      const submitButton = document.getElementById('submit-button');
      const shareUrlContainer = document.getElementById('share-url-container');
      const shareUrlLink = document.getElementById('share-url-link');
      const shareUrlCopyButton = document.getElementById('share-url-copy-button');
      const shareUrlCopyFeedback = document.getElementById('share-url-copy-feedback');

      const showCopyFeedback = (message, isError = false) => {
        if (!shareUrlCopyFeedback) return;
        shareUrlCopyFeedback.textContent = message;
        shareUrlCopyFeedback.classList.remove('opacity-0', 'opacity-100', 'text-primary', 'text-destructive');
        shareUrlCopyFeedback.classList.add(isError ? 'text-destructive' : 'text-primary', 'opacity-100');
        setTimeout(() => {
          shareUrlCopyFeedback.classList.remove('opacity-100');
          shareUrlCopyFeedback.classList.add('opacity-0');
        }, 1500);
      };

      const setShareUrl = (url) => {
        if (!url || !shareUrlLink) return;
        const sanitizedUrl = url.toString();
        shareUrlLink.href = sanitizedUrl;
        shareUrlLink.textContent = sanitizedUrl;
        shareUrlLink.setAttribute('data-url', sanitizedUrl);
        if (shareUrlContainer) {
          shareUrlContainer.classList.remove('hidden');
        }
        config.shareUrl = sanitizedUrl;
      };

      const buildChainsIndex = () => {
        const map = {};
        config.currencies.forEach((curr) => {
          map[curr.currency] = curr.chains;
        });
        return map;
      };

      const getDefaultCurrency = () =>
        config.currencies.find((c) => c.isPrimary) || config.currencies[0] || null;

      let chainsByCurrency = buildChainsIndex();

      const initialShareUrl = config.shareUrl || window.location.href;
      setShareUrl(initialShareUrl);

      if (shareUrlCopyButton) {
        shareUrlCopyButton.addEventListener('click', async () => {
          if (!shareUrlLink) {
            return;
          }
          const targetUrl =
            shareUrlLink.getAttribute('data-url') ||
            shareUrlLink.getAttribute('href') ||
            shareUrlLink.textContent ||
            '';

          if (!targetUrl) {
            showCopyFeedback('No link available', true);
            return;
          }

          try {
            if (typeof navigator === 'undefined' || !navigator.clipboard) {
              throw new Error('Clipboard unavailable');
            }
            await navigator.clipboard.writeText(targetUrl);
            showCopyFeedback('Copied!');
          } catch (error) {
            showCopyFeedback('Copy failed', true);
          }
        });
      }

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

      const updateAmountDisplays = (displayText) => {
        if (amountDisplay) {
          amountDisplay.textContent = displayText;
        }
        if (mobileAmountDisplay) {
          mobileAmountDisplay.textContent = displayText;
        }
      };

      const applyTheme = (nextTheme) => {
        if (!nextTheme) return;
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(nextTheme === 'light' ? 'light' : 'dark');
        config.theme = nextTheme === 'light' ? 'light' : 'dark';
      };

      const updateAmountSectionVisibility = () => {
        const isUserInput = config.amountType === 'user_input';
        if (amountInputSection) {
          amountInputSection.classList.toggle('hidden', !isUserInput);
        }
        if (amountInput) {
          amountInput.disabled = !isUserInput;
          amountInput.required = isUserInput;
          if (!isUserInput) {
            amountInput.value = '';
          }
        }
      };

      const updateChainOptions = () => {
        const defaultCurrency = getDefaultCurrency();
        chainsByCurrency = buildChainsIndex();

        const selectedCurrency =
          (currencySelect && currencySelect.value) ||
          (defaultCurrency ? defaultCurrency.currency : '');

        const chains = selectedCurrency ? chainsByCurrency[selectedCurrency] || [] : [];

        if (chainSelect) {
          chainSelect.innerHTML = chains
            .map((chain) => {
              const name = chain
                .split('-')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
              return '<option value="' + chain + '">' + name + '</option>';
            })
            .join('');
        }

        const currencyConfig =
          config.currencies.find((c) => c.currency === selectedCurrency) || defaultCurrency;

        if (!currencyConfig) {
          updateAmountDisplays('');
          return;
        }

        if (config.amountType === 'user_input') {
          updateAmountDisplays('Custom Amount');
        } else {
          const referenceAmount =
            currencyConfig.amount ?? config.defaultAmount ?? (defaultCurrency ? defaultCurrency.amount : 0);

          const formattedAmount = Number(referenceAmount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          });

          const symbol = selectedCurrency || (currencyConfig ? currencyConfig.currency : '');
          updateAmountDisplays(formattedAmount + ' ' + (symbol || ''));
        }
      };

      const applyPreviewUpdate = (payload) => {
        if (!payload || typeof payload !== 'object') {
          return;
        }

        if (typeof payload.title === 'string') {
          const title = payload.title.trim();
          config.title = title;
          if (summaryTitle) {
            summaryTitle.textContent = title || 'Untitled';
          }
          document.title = (title || 'Untitled') + ' · PayIn Checkout';
        }

        if ('description' in payload) {
          const description = payload.description ?? '';
          config.description = description;
          if (summaryDescription) {
            if (description) {
              summaryDescription.textContent = description;
              summaryDescription.classList.remove('hidden');
            } else {
              summaryDescription.textContent = '';
              summaryDescription.classList.add('hidden');
            }
          } else if (description && summaryTitle && summaryTitle.parentElement) {
            const paragraph = document.createElement('p');
            paragraph.id = 'summary-description';
            paragraph.className = 'text-sm text-muted-foreground leading-relaxed';
            paragraph.textContent = description;
            summaryTitle.parentElement.appendChild(paragraph);
          }
        }

        if (typeof payload.ctaText === 'string' && submitButton) {
          const buttonLabel = payload.ctaText.trim() || 'Continue to payment';
          config.ctaText = buttonLabel;
          submitButton.textContent = buttonLabel;
        }

        if (typeof payload.amount === 'string') {
          config.defaultAmount = payload.amount;
        }

        if (Array.isArray(payload.currencies)) {
          config.currencies = payload.currencies.map((curr) => ({
            currency: curr.currency,
            amount: curr.amount ?? null,
            chains: Array.isArray(curr.chain_options) ? curr.chain_options : [],
            isPrimary: Boolean(curr.is_primary),
          }));
          if (currencySelect) {
            const primary =
              config.currencies.find((c) => c.isPrimary) || config.currencies[0] || null;
            if (primary) {
              currencySelect.value = primary.currency;
            }
          }
        }

        if (typeof payload.amountType === 'string') {
          config.amountType = payload.amountType === 'user_input' ? 'user_input' : 'fixed';
        }

        if (typeof payload.theme === 'string') {
          applyTheme(payload.theme);
        }

        updateAmountSectionVisibility();
        updateChainOptions();
      };

      applyTheme(config.theme);
      updateAmountSectionVisibility();
      updateChainOptions();
      if (currencySelect) {
        currencySelect.addEventListener('change', updateChainOptions);
      }

      window.addEventListener('message', (event) => {
        if (!event || typeof event.data !== 'object') {
          return;
        }
        if (event.data.type !== 'PREVIEW_UPDATE') {
          return;
        }
        applyPreviewUpdate(event.data.payload || {});
      });

      form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError();

        const defaultCurrency = getDefaultCurrency();
        const email = emailInput?.value?.trim() || '';
        const currency =
          (currencySelect && currencySelect.value) ||
          (defaultCurrency ? defaultCurrency.currency : '');
        const chainId = chainSelect?.value || '';
        const userAmount =
          config.amountType === 'user_input' ? amountInput?.value?.trim() : null;

        if (!email) {
          showError('Email address is required so we can send you payment updates.');
          return;
        }

        if (config.amountType === 'user_input') {
          if (!userAmount || Number(userAmount) <= 0) {
            showError('Please enter a valid amount greater than 0.');
            return;
          }
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
          const requestBody = { email, currency, chainId };
          if (config.amountType === 'user_input' && userAmount) {
            requestBody.amount = userAmount;
          }

          const response = await fetch(
            config.apiBase + '/api/payment-links/' + config.slug + '/orders',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            }
          );

          const payload = await response.json();

          if (!response.ok || !payload?.success) {
            const message = payload?.message || payload?.error || 'Failed to create payment order.';
            throw new Error(message);
          }

          const data = payload.data || {};
          const order = data.order || {};
          const orderId = order.orderId || order.id;
          const targetUrl = orderId ? config.orderBaseUrl + '/' + orderId : null;

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

      hideError();
    })();
  `;


  // Prepare order summary data
  const orderSummaryData = {
    title: data.title,
    description: data.description,
    amount: primaryAmount || data.defaultAmount || '0',
    currency: primaryCurrencySymbol,
    networksDescription,
    shareUrl: data.shareUrl,
    isPreview: mode === 'preview',
  };

  return (
    <PaymentLayout
      theme={theme}
      title={`${sanitize(data.title)} · PayIn Checkout`}
      metaDescription={`Secure checkout for ${sanitize(data.title)}.`}
      isPreview={mode === 'preview'}
      previewViewport={previewViewport}
      stylesheetUrl={`${options.apiBaseUrl}/dist/assets/style.css`}
      headContent={<style dangerouslySetInnerHTML={{ __html: baseStyles }} />}
      inlineScript={inlineScript}
      leftColumn={<OrderSummary data={orderSummaryData} />}
      rightColumn={
        <div className="bg-card border rounded-xl p-6 lg:p-8">
          <h2 className="text-xl font-semibold mb-6">Payment details</h2>

          <form id="checkout-form" className="space-y-6">

                  {/* Email field */}
                  <div>
                    <label htmlFor="email-input" className="block text-sm font-medium mb-2">
                      Email
                    </label>
                    <input
                      id="email-input"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      className="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Payment confirmation will be sent to this address</p>
                  </div>

                  {/* Currency selector (if multiple) */}
                  {showCurrencySelector && (
                    <div>
                      <label htmlFor="currency-select" className="block text-sm font-medium mb-2">
                        Currency
                      </label>
                      <select
                        id="currency-select"
                        name="currency"
                        required
                        className="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      >
                        {currencies.map((curr) => (
                          <option key={curr.currency} value={curr.currency}>
                            {curr.currency}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-muted-foreground">Choose your preferred stablecoin</p>
                    </div>
                  )}

                  {/* Amount input (toggled for user_input amount type) */}
                  <div
                    id="amount-input-section"
                    className={showAmountInput ? '' : 'hidden'}
                  >
                    <label htmlFor="amount-input" className="block text-sm font-medium mb-2">
                      Amount
                    </label>
                    <input
                      id="amount-input"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required={showAmountInput}
                      disabled={!showAmountInput}
                      placeholder="Enter amount"
                      className="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Enter the amount you wish to pay</p>
                  </div>

                  {/* Chain selector */}
                  {showChainSelector ? (
                    <div>
                      <label htmlFor="chain-select" className="block text-sm font-medium mb-2">
                        Network
                      </label>
                      <select
                        id="chain-select"
                        name="chainId"
                        required
                        className="w-full h-12 px-4 text-base bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      >
                        {/* Options will be populated by JavaScript */}
                      </select>
                      <p className="mt-2 text-xs text-muted-foreground">Select the blockchain network for your transaction</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-2">Network</label>
                      <input
                        value="No networks configured"
                        disabled
                        className="w-full h-12 px-4 text-base bg-muted border border-input rounded-lg opacity-50 cursor-not-allowed"
                      />
                    </div>
                  )}

                  {/* Submit button */}
                  <div className="pt-4">
        <button
          id="submit-button"
          type="submit"
          disabled={mode === 'preview'}
          className="w-full h-12 px-6 text-base font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
        >
          {ctaText}
        </button>
                  </div>

                  {/* Error message */}
                  <div id="error-box" className="hidden p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"></div>

                  {/* Loading indicator */}
                  <div id="loading-indicator" className="hidden text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processing...</span>
                    </div>
                  </div>

          </form>

          {/* Terms */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our terms of service. All cryptocurrency transactions are final and non-refundable.
            </p>
          </div>

        </div>
      }
    />
  );
}
