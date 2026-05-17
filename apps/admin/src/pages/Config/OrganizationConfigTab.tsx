/**
 * OrganizationConfigTab Component
 * Organization owner/admin tab for managing organization-level configuration
 */

import { useQuery } from '@tanstack/react-query';
import { Building2, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfigTable } from '@/components/config-management/ConfigTable';

export function OrganizationConfigTab() {
  const { organization, isAuthenticated } = useAuth();

  // Fetch configuration metadata
  const { data: metadataResponse, isLoading: metadataLoading } = useQuery({
    queryKey: ['config-metadata', 'all'],
    queryFn: () => api.listConfigMetadata(),
    enabled: isAuthenticated,
  });

  // Fetch organization configuration values with inheritance
  const {
    data: configResponse,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['config-values', 'organization', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { data: [] };

      // Fetch both global and organization configs
      const [globalConfigs, orgConfigs] = await Promise.all([
        api.listConfigValues({ scope: 'global' }),
        api.listConfigValues({
          scope: 'organization',
          organization_id: organization.id,
        }),
      ]);

      // Merge and compute effective values
      const metadata = metadataResponse?.data || [];
      const globalMap = new Map((globalConfigs.data || []).map((c: any) => [c.key, c.value]));
      const orgMap = new Map((orgConfigs.data || []).map((c: any) => [c.key, c.value]));

      const enrichedConfigs = metadata.map((meta: any) => {
        const orgValue = orgMap.get(meta.key);
        const globalValue = globalMap.get(meta.key);
        const effectiveValue = orgValue ?? globalValue ?? meta.default_value;
        const effectiveSource = orgValue !== undefined ? 'organization' : globalValue !== undefined ? 'global' : 'metadata';

        return {
          key: meta.key,
          value: orgValue,
          organization_id: organization.id,
          effective_value: effectiveValue,
          effective_source: effectiveSource as 'global' | 'organization' | 'metadata',
          global_value: globalValue,
          organization_value: orgValue,
          metadata: meta,
        };
      });

      return { data: enrichedConfigs };
    },
    enabled: isAuthenticated && !!organization?.id && !metadataLoading,
  });

  const canManage = organization?.role === 'owner' || organization?.role === 'admin';
  const isLoading = metadataLoading || configLoading;

  const metadata = metadataResponse?.data || [];
  const configs = configResponse?.data || [];

  // Access denied for non-owner/admin
  if (!isLoading && !canManage) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only organization owners and admins can manage organization configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const orgConfigs = configs.filter((c: any) => c.organization_value !== undefined);
  const usingGlobal = configs.filter((c: any) => c.effective_source === 'global').length;
  const usingDefaults = configs.filter((c: any) => c.effective_source === 'metadata').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Organization Configuration</h2>
          </div>
          <p className="text-muted-foreground">
            Manage configuration for <span className="font-semibold text-foreground">{organization?.name}</span>.
            Override global settings for your organization.
          </p>
        </div>
        <Button onClick={() => refetchConfig()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Configuration Inheritance Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Configuration Inheritance</AlertTitle>
        <AlertDescription>
          Organization settings override global settings. If a setting is not configured for your organization,
          the global value will be used. If no global value exists, the system default will be applied.
        </AlertDescription>
      </Alert>

      {/* Configuration Table */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Values</CardTitle>
          <CardDescription>
            View and modify organization-specific configuration. Values marked with a badge show the current source.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-[200px]" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <ConfigTable
              configs={configs}
              metadata={metadata}
              organizationId={organization?.id}
              scope="organization"
              canEdit={canManage}
              showInheritance={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Total Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metadata.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Available configuration keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Organization Overrides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{orgConfigs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Custom organization values</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Using Global</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{usingGlobal}</div>
              <p className="text-xs text-muted-foreground mt-1">Inheriting from global</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Using Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{usingDefaults}</div>
              <p className="text-xs text-muted-foreground mt-1">Using system defaults</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
