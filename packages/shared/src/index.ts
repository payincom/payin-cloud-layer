// PayIn Shared Package - Logger system only
// All unused historical code has been removed

// Logger system - the only functionality currently used by processor and monitor
export * from './logger/index.js';

// Configuration Provider Interface
export * from './config/index.js';

// Payment Link checkout renderer (shared between API + Admin)
// ✅ New React-based renderer with auto environment detection
export * from './checkout/index.js';

// ❌ Deprecated: Legacy string template (kept for backward compatibility)
// export * from './payment-link-checkout-template';

// Version information
export const SDK_VERSION = '1.0.0';
