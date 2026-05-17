/**
 * Configuration Provider Interface
 *
 * Provides a secure, minimal interface for accessing configuration values
 * with organization isolation support.
 *
 * This interface follows the Principle of Least Privilege - it only exposes
 * read access to configuration, preventing modification through this interface.
 */
export interface ConfigProvider {
  /**
   * Get configuration value with organization isolation
   *
   * Priority:
   * 1. Organization-level config (if organizationId provided)
   * 2. Global config_values (organization_id IS NULL)
   * 3. config_metadata.default_value
   * 4. Returns undefined if config key doesn't exist
   *
   * @param key - Configuration key (e.g., 'orders.payment_window_minutes')
   * @param organizationId - Organization ID for organization-level config
   * @returns Configuration value or undefined if not found
   *
   * @example
   * ```typescript
   * // Get organization-specific config
   * const value = await configProvider.getConfig(
   *   'orders.payment_window_minutes',
   *   'org-123-uuid'
   * );
   *
   * // Get global config (fallback)
   * const value = await configProvider.getConfig(
   *   'orders.payment_window_minutes'
   * );
   * ```
   */
  getConfig(key: string, organizationId?: string): Promise<any | undefined>;
}
