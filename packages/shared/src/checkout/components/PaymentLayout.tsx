/**
 * Shared Payment Layout Component (SSR)
 * Provides consistent two-column layout with footer
 */
import React from 'react';

export interface PaymentLayoutProps {
  /** Theme mode */
  theme?: 'light' | 'dark' | 'auto';
  /** Page title */
  title: string;
  /** Page description for meta tags */
  metaDescription?: string;
  /** Preview mode flag */
  isPreview?: boolean;
  /** Preview viewport (only for preview mode) */
  previewViewport?: 'desktop' | 'mobile';
  /** CSS stylesheet URL */
  stylesheetUrl?: string;
  /** Vite dev client script URL */
  viteClientUrl?: string;
  /** Left column content (Order Summary) */
  leftColumn: React.ReactNode;
  /** Right column content (Action Area - Form or Payment Info) */
  rightColumn: React.ReactNode;
  /** Additional inline scripts */
  inlineScript?: string;
  /** Additional head content */
  headContent?: React.ReactNode;
}

/**
 * Shared layout for Checkout and Order pages
 * Provides consistent two-column layout with footer
 */
export function PaymentLayout({
  theme = 'dark',
  title,
  metaDescription,
  isPreview = false,
  previewViewport = 'desktop',
  stylesheetUrl,
  viteClientUrl,
  leftColumn,
  rightColumn,
  inlineScript,
  headContent,
}: PaymentLayoutProps) {
  return (
    <html lang="en" className={theme}>
      <head>
        <meta charSet="utf-8" />
        {isPreview ? (
          previewViewport === 'mobile' ? (
            <meta name="viewport" content="width=375, initial-scale=1" />
          ) : (
            <meta name="viewport" content="width=1400, initial-scale=1" />
          )
        ) : (
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        )}
        <title>{title}</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}
        {viteClientUrl && <script type="module" src={viteClientUrl}></script>}
        {isPreview && <meta name="robots" content="noindex" />}
        {headContent}
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col">
        {/* Main container with responsive layout - flex-1 to push footer down */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

            {/* Left column - Order Summary (sticky on desktop) */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-8">
                {leftColumn}
              </div>
            </div>

            {/* Right column - Action Area (Form or Payment Info) */}
            <div className="lg:col-span-7">
              {rightColumn}
            </div>

          </div>
        </div>

        {/* Footer - stays at bottom */}
        <footer className="py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm text-muted-foreground">
              Powered by <span className="font-brand font-medium text-foreground">PayIn</span> · Secure multi-chain payments
            </div>
          </div>
        </footer>

        {/* Inline script */}
        {inlineScript && <script dangerouslySetInnerHTML={{ __html: inlineScript }} />}
      </body>
    </html>
  );
}
