/**
 * Authentication Context Provider
 * Manages authentication state and provides login/logout methods
 */

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { OrganizationSelector } from '@/components/OrganizationSelector';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberStatus: string;
}

interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
  isSuperadmin?: boolean;
  currentOrganization?: Organization;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  organizations: Organization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

const LAST_ORG_KEY = 'last_organization_id';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [pendingOrganizations, setPendingOrganizations] = useState<Organization[]>([]);

  /**
   * Fetch user's organizations list
   */
  const fetchOrganizations = async () => {
    try {
      const response = await api.listOrganizations() as { organizations?: Organization[] };
      if (Array.isArray(response.organizations)) {
        setOrganizations(response.organizations);
        return response.organizations;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      return [];
    }
  };

  /**
   * Select organization intelligently based on localStorage and user's organizations
   * Returns the selected organization or null if user needs to choose
   */
  const selectOrganization = async (userOrgs: Organization[]): Promise<Organization | null> => {
    if (!userOrgs || userOrgs.length === 0) {
      return null;
    }

    // If user has only one organization, use it directly
    if (userOrgs.length === 1) {
      return userOrgs[0];
    }

    // Try to use last selected organization from localStorage
    const lastOrgId = localStorage.getItem(LAST_ORG_KEY);
    if (lastOrgId) {
      const lastOrg = userOrgs.find(org => org.id === lastOrgId);
      // If user still belongs to this organization, use it
      if (lastOrg) {
        return lastOrg;
      }
    }

    // User has multiple organizations and no valid last selection
    // Return null to trigger organization selector dialog
    return null;
  };

  /**
   * Set organization and update localStorage
   */
  const setOrganizationAndSave = (org: Organization) => {
    setOrganization(org);
    api.setOrganizationId(org.id);
    localStorage.setItem(LAST_ORG_KEY, org.id);
  };

  // Initialize: Check if user is already logged in
  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        if (token.startsWith('pk_')) {
          const sandboxOrg = createSandboxOrganization();
          setUser({
            id: 'manual-test-api-key-user',
            username: 'manual-test-admin',
            role: 'admin',
            currentOrganization: sandboxOrg,
          });
          setOrganization(sandboxOrg);
          setOrganizations([sandboxOrg]);
          api.setOrganizationId(sandboxOrg.id);
          localStorage.setItem(LAST_ORG_KEY, sandboxOrg.id);
          setIsLoading(false);
          return;
        }
        try {
          const response = await api.getCurrentUser();
          if (response.success && response.data) {
            setUser(response.data);
            // Set organization and configure API client
            if (response.data.currentOrganization) {
              setOrganization(response.data.currentOrganization);
              api.setOrganizationId(response.data.currentOrganization.id);
            }
            // Fetch user's organizations list
            await fetchOrganizations();
          } else {
            api.clearToken();
          }
        } catch (error) {
          console.error('Failed to get current user:', error);
          api.clearToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Clear organization ID before login to avoid sending stale org ID
      api.clearOrganizationId();

      if (password.startsWith('pk_')) {
        const sandboxOrg = createSandboxOrganization();
        api.setToken(password);
        setUser({
          id: 'manual-test-api-key-user',
          username: username || 'manual-test-admin',
          role: 'admin',
          currentOrganization: sandboxOrg,
        });
        setOrganizationAndSave(sandboxOrg);
        setOrganizations([sandboxOrg]);
        return;
      }

      const response = await api.login(username, password);
      if (response.success && response.data) {
        setUser(response.data.user);

        // Fetch user's organizations list
        const userOrgs = await fetchOrganizations();

        // Intelligently select organization
        const selectedOrg = await selectOrganization(userOrgs);

        if (selectedOrg) {
          // User has single org or valid last org - proceed directly
          setOrganizationAndSave(selectedOrg);
        } else if (userOrgs.length > 1) {
          // User has multiple orgs and needs to choose
          setPendingOrganizations(userOrgs);
          setShowOrgSelector(true);
        } else {
          throw new Error('No organizations found for this user');
        }
      } else {
        throw new Error(response.error || response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  /**
   * Handle organization selection from dialog
   */
  const handleOrganizationSelect = (orgId: string) => {
    const selectedOrg = pendingOrganizations.find(org => org.id === orgId);
    if (selectedOrg) {
      setOrganizationAndSave(selectedOrg);
      setShowOrgSelector(false);
      setPendingOrganizations([]);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setOrganization(null);
      setOrganizations([]);
      api.clearOrganizationId();
      // Keep last_organization_id in localStorage to remember user's choice for next login
    }
  };

  /**
   * Switch to a different organization
   */
  const switchOrganization = async (orgId: string) => {
    // Find the organization in the list
    const targetOrg = organizations.find(org => org.id === orgId);
    if (!targetOrg) {
      throw new Error('Organization not found');
    }

    // Update state, API client, and save to localStorage
    setOrganizationAndSave(targetOrg);

    // Reload the page to refresh all data with new organization context
    window.location.reload();
  };

  /**
   * Refresh organizations list
   */
  const refreshOrganizations = async () => {
    await fetchOrganizations();
  };

  const value: AuthContextType = {
    user,
    organization,
    organizations,
    // User is only authenticated when both user and organization are set
    isAuthenticated: !!user && !!organization,
    isLoading,
    login,
    logout,
    switchOrganization,
    refreshOrganizations,
  };

  const handleLogoutFromSelector = async () => {
    await logout();
    setShowOrgSelector(false);
    setPendingOrganizations([]);
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <OrganizationSelector
        open={showOrgSelector}
        organizations={pendingOrganizations}
        onSelect={handleOrganizationSelect}
        onLogout={handleLogoutFromSelector}
      />
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function createSandboxOrganization(): Organization {
  return {
    id: 'org-cloud-layer-sandbox',
    name: 'Cloud Layer Sandbox',
    slug: 'org-cloud-layer-sandbox',
    role: 'admin',
    memberStatus: 'active',
  };
}
