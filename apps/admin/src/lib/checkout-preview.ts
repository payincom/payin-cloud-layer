interface PreviewCurrency {
  currency: string;
  chains: string[];
  amount: string;
  isPrimary: boolean;
}

interface PreviewPaymentLink {
  slug?: string | null;
  title: string;
  description: string | null;
  defaultAmount: string;
  amountType: string;
  ctaText: string | null;
  theme: string;
  currencies: PreviewCurrency[];
  shareUrl?: string | null;
  inventoryTotal?: number | null;
  inventoryReserved?: number | null;
  inventorySold?: number | null;
}

interface PreviewRenderOptions {
  mode?: string;
  previewViewport: string;
  requestOrigin?: string;
  apiBaseUrl?: string;
  orderBaseUrl?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPaymentLinkCheckoutPageBrowser(
  paymentLink: PreviewPaymentLink,
  options: PreviewRenderOptions,
) {
  const title = escapeHtml(paymentLink.title || 'Untitled');
  const description = paymentLink.description ? escapeHtml(paymentLink.description) : 'Preview payment link checkout';
  const amount = escapeHtml(paymentLink.defaultAmount || '0');
  const ctaText = escapeHtml(paymentLink.ctaText || 'Pay now');
  const themeClass = paymentLink.theme === 'dark' ? 'dark' : 'light';
  const maxWidth = options.previewViewport === 'mobile' ? '390px' : '720px';
  const currencyItems = paymentLink.currencies
    .map((currency) => {
      const chainLabel = currency.chains.length > 0 ? currency.chains.join(', ') : 'default chain';
      return `<li><strong>${escapeHtml(currency.currency)}</strong><span>${escapeHtml(chainLabel)}</span></li>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #0f172a; }
    body.dark { background: #020617; color: #f8fafc; }
    main { width: min(${maxWidth}, calc(100vw - 32px)); border-radius: 24px; padding: 32px; background: Canvas; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18); }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0 0 24px; color: #64748b; }
    .amount { font-size: 36px; font-weight: 800; margin-bottom: 20px; }
    ul { list-style: none; padding: 0; margin: 0 0 24px; display: grid; gap: 8px; }
    li { display: flex; justify-content: space-between; gap: 16px; border: 1px solid #dbe3ef; border-radius: 12px; padding: 12px; }
    button { width: 100%; border: 0; border-radius: 999px; padding: 14px 18px; background: #2563eb; color: white; font-weight: 700; }
  </style>
</head>
<body class="${themeClass}">
  <main>
    <h1>${title}</h1>
    <p>${description}</p>
    <div class="amount">${amount}</div>
    <ul>${currencyItems}</ul>
    <button>${ctaText}</button>
  </main>
</body>
</html>`;
}
