/**
 * API Client for PayIn Admin UI
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface CloudLayerControlPlaneStatus {
  ok: boolean;
  provider: string;
  mode: 'local-dev' | 'railway-proof';
  productionSecurity: false;
  deterministic: boolean;
  storage: string;
  namespace: string;
  counts: {
    organizations: number;
    users: number;
    sessions: number;
    apiKeys: number;
  };
}

export interface CloudLayerOrganization {
  id: string;
  slug: string;
  name: string;
  mode: 'local-dev';
  createdAt: string;
}

export interface CloudLayerUser {
  id: string;
  email: string;
  displayName: string;
  organizationIds: string[];
  createdAt: string;
}

export interface CloudLayerSessionSummary {
  id: string;
  sessionPreview: string;
  sensitiveMaterialReturned: false;
  userId: string;
  organizationId: string;
  expiresAt: string;
}

export interface CloudLayerApiKeyPreview {
  id: string;
  organizationId: string;
  label: string;
  preview: string;
  checksum: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export interface CloudLayerEntitlement {
  feature: string;
  granted: boolean;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    reset: 'never';
  };
}

export interface CloudLayerBootstrapResponse {
  localDevOnly: true;
  organization: CloudLayerOrganization;
  user: CloudLayerUser;
  session: CloudLayerSessionSummary;
  entitlements: CloudLayerEntitlement[];
}

export interface CloudLayerDevLoginResponse {
  authenticated: true;
  localDevOnly: true;
  productionSecurity: false;
  authBoundary?: 'local-preview' | 'server-session-cookie';
  user: CloudLayerUser;
  organization: CloudLayerOrganization;
  session: CloudLayerSessionSummary;
}

export interface CloudLayerCurrentOrgResponse {
  localDevOnly: true;
  tenant: {
    id: string;
    organizationId: string;
    source: 'header' | 'default-local';
  };
  organization: CloudLayerOrganization;
  users: CloudLayerUser[];
}

export interface CloudLayerApiKeysResponse {
  localDevOnly: true;
  organizationId: string;
  apiKeys: CloudLayerApiKeyPreview[];
}

export interface CloudLayerCreateApiKeyResponse {
  localDevOnly: true;
  productionSecurity: false;
  apiKey: CloudLayerApiKeyPreview;
  sensitiveMaterialReturned: false;
  message: string;
}

export interface CloudLayerEntitlementsResponse {
  localDevOnly: true;
  organizationId: string;
  evaluation: string;
  entitlements: CloudLayerEntitlement[];
}

class ApiClient {
  private token: string | null = null;
  private organizationId: string | null = null;

  constructor() {
    // Load token and organizationId from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
    this.organizationId = localStorage.getItem('last_organization_id');
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  isLocalDevToken(): boolean {
    return this.token?.startsWith('local-dev-control-plane:') || this.token?.startsWith('simulated-email-session-preview:') || false;
  }

  /**
   * Set current organization ID (in memory only, localStorage managed by AuthContext)
   */
  setOrganizationId(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Clear organization ID (in memory only, localStorage managed by AuthContext)
   */
  clearOrganizationId() {
    this.organizationId = null;
  }

  /**
   * Get current organization ID
   */
  getOrganizationId(): string | null {
    return this.organizationId;
  }

  /**
   * Make HTTP request
   */
  private async request<T = any>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add X-Organization-ID header for multi-tenant support (required for JWT auth)
    // Skip for auth endpoints that don't require organization context
    const skipOrgHeader = path === '/auth/login' || path === '/auth/register' || path === '/auth/oauth/callback' || path === '/organizations';
    if (this.organizationId && !skipOrgHeader) {
      headers['X-Organization-ID'] = this.organizationId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - clear token
        if (response.status === 401) {
          this.clearToken();
        }
        throw new Error(data.message || data.error || 'Request failed');
      }

      return data as T;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ==================== Auth Endpoints ====================

  async login(username: string, password: string) {
    const response = await this.request<{
      success: boolean;
      data?: { token: string; user: any };
      error?: string;
      message?: string;
    }>('POST', '/auth/login', {
      username,
      password,
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout() {
    if (this.token) {
      try {
        await this.request('POST', '/auth/logout', { token: this.token });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }
    this.clearToken();
  }

  async getCurrentUser() {
    return this.request<{
      success: boolean;
      data?: any;
      error?: string;
      message?: string;
    }>('GET', '/auth/me');
  }

  // ==================== Order Endpoints ====================

  async listOrders(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/orders${params ? `?${params}` : ''}`);
  }

  async getOrder(orderId: string) {
    return this.request('GET', `/orders/${orderId}`);
  }

  async getOrderStats(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/orders/stats${params ? `?${params}` : ''}`);
  }

  // ==================== Deposit Endpoints ====================

  async listDepositReferences(filters?: { page?: number; limit?: number; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.search) params.append('search', filters.search);
    return this.request('GET', `/deposits/references${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async listDeposits(filters?: Record<string, any>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    return this.request('GET', `/deposits${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async bindUserAddress(params: { depositReference: string; protocol: 'evm' | 'tron'; metadata?: any }) {
    return this.request('POST', '/deposits/bind', params);
  }

  async unbindAddressByAddress(params: { address: string; protocol: 'evm' | 'tron' }) {
    return this.request('POST', '/deposits/unbind', params);
  }

  async getDepositStats(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/deposits/stats${params ? `?${params}` : ''}`);
  }

  // ==================== Transfer Endpoints ====================

  async listTransfers(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/transfers${params ? `?${params}` : ''}`);
  }

  // ==================== Payment Link Endpoints ====================

  async listPaymentLinks(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
    archived?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.includeArchived) params.append('includeArchived', 'true');
    if (filters?.archived) params.append('archived', 'true');
    const query = params.toString();
    return this.request('GET', `/payment-links${query ? `?${query}` : ''}`);
  }

  async getPaymentLink(paymentLinkId: string) {
    return this.request('GET', `/payment-links/${paymentLinkId}`);
  }

  async createPaymentLink(data: {
    title: string;
    description?: string | null;
    amount: string;
    currencies: Array<{
      currency: string;
      chainOptions: string[];
      amount?: string | null;
      isPrimary: boolean;
    }>;
    inventoryTotal?: number | null;
    expiresAt?: string | null;
    metadata?: Record<string, any> | null;
    amountType?: 'fixed' | 'user_input';
    ctaText?: string | null;
    theme?: 'dark' | 'light';
  }) {
    return this.request('POST', '/payment-links', data);
  }

  async updatePaymentLink(paymentLinkId: string, updates: {
    title?: string;
    description?: string | null;
    amount?: string;
    inventoryTotal?: number | null;
    expiresAt?: string | null;
    metadata?: Record<string, any> | null;
    amountType?: 'fixed' | 'user_input';
    ctaText?: string | null;
    theme?: 'dark' | 'light';
  }) {
    return this.request('PUT', `/payment-links/${paymentLinkId}`, updates);
  }

  async updatePaymentLinkCurrencies(paymentLinkId: string, currencies: Array<{
    currency: string;
    chainOptions: string[];
    amount?: string | null;
    isPrimary: boolean;
  }>) {
    return this.request('PUT', `/payment-links/${paymentLinkId}/currencies`, { currencies });
  }

  async createPaymentLinkPreviewUrl(paymentLinkId: string) {
    return this.request('POST', `/payment-links/${paymentLinkId}/preview-url`);
  }

  async publishPaymentLink(paymentLinkId: string, slug?: string) {
    return this.request('POST', `/payment-links/${paymentLinkId}/publish`, slug ? { slug } : {});
  }

  async unpublishPaymentLink(paymentLinkId: string) {
    return this.request('POST', `/payment-links/${paymentLinkId}/unpublish`);
  }

  async archivePaymentLink(paymentLinkId: string) {
    return this.request('POST', `/payment-links/${paymentLinkId}/archive`);
  }

  async restorePaymentLink(paymentLinkId: string) {
    return this.request('POST', `/payment-links/${paymentLinkId}/restore`);
  }

  async listPaymentLinkOrders(paymentLinkId: string) {
    return this.request('GET', `/payment-links/${paymentLinkId}/orders`);
  }

  async getPaymentLinkStats(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/payment-links/stats${params ? `?${params}` : ''}`);
  }

  async getTransfersByReference(filters?: Record<string, any>) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/transfers${params ? `?${params}` : ''}`);
  }

  // ==================== Address Pool Endpoints ====================

  async getAddressPoolAvailability(protocol: string) {
    return this.request('GET', `/address-pool/availability?protocol=${protocol}`);
  }

  async getAddressPoolSummary() {
    return this.request('GET', '/address-pool/summary');
  }

  async getAddresses(filters?: { protocol?: string; page?: number; pageSize?: number }) {
    const params = new URLSearchParams();
    if (filters?.protocol) params.append('protocol', filters.protocol);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));

    return this.request('GET', `/address-pool/addresses${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async addAddressesToPool(addresses: Array<{
    address: string;
    protocol: string;
    derivationIndex: number | null;
    masterPublicKey: string | null;
  }>) {
    return this.request('POST', '/address-pool/addresses', { addresses });
  }

  async archiveAddress(address: string) {
    return this.request('PATCH', `/address-pool/addresses/${encodeURIComponent(address)}/archive`);
  }

  async unarchiveAddress(address: string) {
    return this.request('PATCH', `/address-pool/addresses/${encodeURIComponent(address)}/unarchive`);
  }

  // ==================== Config Endpoints ====================

  async getConfigMetadata(category?: string) {
    const params = category ? `?category=${category}` : '';
    return this.request('GET', `/config/metadata${params}`);
  }

  async getSystemConfig(key: string) {
    return this.request('GET', `/config/${key}`);
  }

  async updateSystemConfig(key: string, value: any) {
    return this.request('PUT', `/config/${key}`, { value });
  }

  async getRuntimeConfig() {
    return this.request('GET', `/config/runtime`);
  }

  // ==================== Config Management (Multi-tenant) ====================

  /**
   * List configuration metadata
   */
  async listConfigMetadata(filters?: { category?: string }) {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    return this.request('GET', `/config-management/metadata${params.toString() ? `?${params.toString()}` : ''}`);
  }

  /**
   * Get single configuration metadata
   */
  async getConfigMetadataByKey(key: string) {
    return this.request('GET', `/config-management/metadata/${key}`);
  }

  /**
   * List configuration values
   */
  async listConfigValues(filters?: {
    scope?: 'global' | 'organization';
    organization_id?: string;
    category?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.scope) params.append('scope', filters.scope);
    if (filters?.organization_id) params.append('organization_id', filters.organization_id);
    if (filters?.category) params.append('category', filters.category);
    return this.request('GET', `/config-management/values${params.toString() ? `?${params.toString()}` : ''}`);
  }

  /**
   * Get single configuration value with inheritance
   */
  async getConfigValue(key: string, organizationId?: string, showInheritance?: boolean) {
    const params = new URLSearchParams();
    if (organizationId) params.append('organization_id', organizationId);
    if (showInheritance) params.append('show_inheritance', 'true');
    return this.request('GET', `/config-management/values/${key}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  /**
   * Create or update configuration value
   */
  async upsertConfigValue(data: {
    key: string;
    value: any;
    organization_id?: string | null;
  }) {
    return this.request('POST', '/config-management/values', data);
  }

  /**
   * Delete configuration value
   */
  async deleteConfigValue(key: string, organizationId?: string) {
    const params = new URLSearchParams();
    if (organizationId) params.append('organization_id', organizationId);
    return this.request('DELETE', `/config-management/values/${key}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  // ==================== Chains & Tokens ====================

  async listChains() {
    return this.request('GET', '/chains');
  }

  async listTokens() {
    return this.request('GET', '/tokens');
  }

  // ==================== Organization Endpoints ====================

  async listOrganizations() {
    return this.request('GET', '/organizations');
  }

  async getOrganization(orgId: string) {
    return this.request('GET', `/organizations/${orgId}`);
  }

  async createOrganization(data: { name: string; slug?: string; website?: string; description?: string }) {
    return this.request('POST', '/organizations', data);
  }

  async updateOrganization(orgId: string, updates: any) {
    return this.request('PATCH', `/organizations/${orgId}`, updates);
  }

  async deleteOrganization(orgId: string) {
    return this.request('DELETE', `/organizations/${orgId}`);
  }

  // ==================== API Keys ====================

  async listApiKeys() {
    return this.request('GET', '/api-keys');
  }

  async createApiKey(name: string, expiresAt?: string) {
    return this.request('POST', '/api-keys', { name, expiresAt });
  }

  async getApiKey(keyId: string) {
    return this.request('GET', `/api-keys/${keyId}`);
  }

  async updateApiKey(keyId: string, updates: { name?: string; isActive?: boolean; expiresAt?: string }) {
    return this.request('PATCH', `/api-keys/${keyId}`, updates);
  }

  async revokeApiKey(keyId: string) {
    return this.request('DELETE', `/api-keys/${keyId}`);
  }

  // ==================== Webhook Endpoints ====================

  async listWebhookEndpoints(filters?: { endpoint_type?: string; is_enabled?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.endpoint_type) params.append('endpoint_type', filters.endpoint_type);
    if (filters?.is_enabled !== undefined) params.append('is_enabled', String(filters.is_enabled));
    return this.request('GET', `/notifications/endpoints${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getWebhookEndpoint(id: string) {
    return this.request('GET', `/notifications/endpoints/${id}`);
  }

  async createWebhookEndpoint(data: {
    endpoint_name: string;
    endpoint_type: 'webhook' | 'email' | 'telegram';
    config: any;
    subscribed_events: string[];
    max_retries?: number;
    timeout_ms?: number;
    description?: string;
    is_enabled?: boolean;
  }) {
    return this.request('POST', '/notifications/endpoints', data);
  }

  async updateWebhookEndpoint(id: string, updates: any) {
    return this.request('PUT', `/notifications/endpoints/${id}`, updates);
  }

  async deleteWebhookEndpoint(id: string) {
    return this.request('DELETE', `/notifications/endpoints/${id}`);
  }

  async testWebhookEndpoint(id: string) {
    return this.request('POST', `/notifications/endpoints/${id}/test`);
  }

  // ==================== Webhook Logs ====================

  async getWebhookLogs(filters?: {
    endpoint_id?: string;
    event_type?: string;
    status?: string;
    business_type?: string;
    business_id?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    return this.request('GET', `/notifications/logs${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getWebhookLog(id: string) {
    return this.request('GET', `/notifications/logs/${id}`);
  }

  async retryWebhookNotification(id: string) {
    return this.request('POST', `/notifications/logs/${id}/retry`);
  }

  async retryFailedNotifications(filters?: {
    endpoint_id?: string;
    event_type?: string;
    failed_after?: string;
  }) {
    return this.request('POST', '/notifications/retry-failed', filters);
  }

  // ==================== Webhook Statistics ====================

  async getWebhookStatistics(endpointId?: string, dateRange?: { startDate: string; endDate: string }) {
    const params = new URLSearchParams();
    if (endpointId) params.append('endpoint_id', endpointId);
    if (dateRange?.startDate) params.append('start_date', dateRange.startDate);
    if (dateRange?.endDate) params.append('end_date', dateRange.endDate);
    return this.request('GET', `/notifications/statistics${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getWebhookQueueStatus() {
    return this.request('GET', '/notifications/queue/status');
  }

  // ==================== Cloud Layer Control Plane ====================

  async getCloudLayerControlPlaneStatus() {
    return this.request<CloudLayerControlPlaneStatus>('GET', '/cloud-layer/control-plane/status');
  }

  async bootstrapCloudLayerControlPlane(data?: { organizationName?: string; email?: string }) {
    return this.request<CloudLayerBootstrapResponse>('POST', '/cloud-layer/control-plane/bootstrap', data);
  }

  async devLoginCloudLayerControlPlane(data?: { email?: string; organizationId?: string }) {
    const response = await this.request<CloudLayerDevLoginResponse>('POST', '/cloud-layer/control-plane/dev-login', data);
    if (response.authenticated && response.session?.id) {
      this.setToken(`local-dev-control-plane:${response.session.id}`);
      this.setOrganizationId(response.organization.id);
      localStorage.setItem('last_organization_id', response.organization.id);
    }
    return response;
  }


  async simulatedEmailLoginCloudLayerControlPlane(data?: { email?: string; organizationId?: string }) {
    const response = await this.request<CloudLayerDevLoginResponse & { simulatedEmailOnly: true; delivery: 'simulated-no-email-sent'; message: string }>(
      'POST',
      '/cloud-layer/control-plane/simulated-email-login',
      data
    );
    if (response.authenticated && response.session?.id) {
      this.setToken(`simulated-email-session-preview:${response.session.id}`);
      this.setOrganizationId(response.organization.id);
      localStorage.setItem('last_organization_id', response.organization.id);
    }
    return response;
  }

  async getCloudLayerCurrentOrg() {
    return this.request<CloudLayerCurrentOrgResponse>('GET', '/cloud-layer/control-plane/org/current');
  }

  async listCloudLayerControlPlaneApiKeys() {
    return this.request<CloudLayerApiKeysResponse>('GET', '/cloud-layer/control-plane/api-keys');
  }

  async createCloudLayerControlPlaneApiKey(label?: string) {
    return this.request<CloudLayerCreateApiKeyResponse>('POST', '/cloud-layer/control-plane/api-keys', { label });
  }

  async getCloudLayerEntitlementsStatus() {
    return this.request<CloudLayerEntitlementsResponse>('GET', '/cloud-layer/control-plane/entitlements/status');
  }

  // ==================== Generic Methods ====================

  async get(path: string) {
    return this.request('GET', path);
  }

  async post(path: string, body?: any) {
    return this.request('POST', path, body);
  }

  async put(path: string, body?: any) {
    return this.request('PUT', path, body);
  }

  async patch(path: string, body?: any) {
    return this.request('PATCH', path, body);
  }

  async delete(path: string) {
    return this.request('DELETE', path);
  }
}

// Export singleton instance
export const api = new ApiClient();
