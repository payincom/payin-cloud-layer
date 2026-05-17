/**
 * Config Page Component
 * Unified configuration management page with tabs for different config types
 *
 * Tab Structure:
 * - Organization Settings: Business configs + Webhooks (organization-scoped)
 * - System Administration: Global configs + Runtime info (system-scoped, super admin only)
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationSettingsTab } from './Config/OrganizationSettingsTab';
import { SystemAdministrationTab } from './Config/SystemAdministrationTab';

export default function Config() {
  const { user, organization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permission checks
  const isSuperAdmin = user?.isSuperadmin === true;
  const canViewOrgSettings = !!organization; // Anyone in an organization can view

  // Available tabs based on permissions
  const tabs = [
    {
      id: 'organization',
      label: 'Organization Settings',
      icon: Building2,
      show: canViewOrgSettings,
      component: OrganizationSettingsTab,
    },
    {
      id: 'system',
      label: 'System Administration',
      icon: Shield,
      show: isSuperAdmin,
      component: SystemAdministrationTab,
    },
  ].filter((tab) => tab.show);

  // Determine default tab
  const getDefaultTab = () => {
    if (canViewOrgSettings) return 'organization';
    if (isSuperAdmin) return 'system';
    return 'organization'; // Fallback
  };

  // Get current tab from URL or use default
  const currentTab = searchParams.get('tab') || getDefaultTab();

  // Validate tab exists and user has permission
  const validTab = tabs.find((t) => t.id === currentTab) ? currentTab : getDefaultTab();

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Set initial tab in URL if not present
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: validTab }, { replace: true });
    }
  }, []);

  // When no tabs are available, render an empty state message instead of the tab layout
  if (tabs.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Configuration options are not available for your account.
        </div>
      </div>
    );
  }

  // When only one tab is accessible, render its content directly and skip the tab UI
  if (tabs.length === 1) {
    const SingleTabComponent = tabs[0].component;
    return (
      <div className="p-6 space-y-6">
        <SingleTabComponent />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Tabs value={validTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full max-w-2xl ${tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => {
          const Component = tab.component;
          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-6">
              <Component />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
