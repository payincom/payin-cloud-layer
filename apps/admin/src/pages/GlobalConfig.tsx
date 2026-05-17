/**
 * GlobalConfig Page
 * Super admin page for managing global configuration values
 */

import { useQuery } from '@tanstack/react-query';
import { Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfigTable } from '@/components/config-management/ConfigTable';

export default function GlobalConfig() {
  const { user, isAuthenticated } = useAuth();

  // Fetch configuration metadata
  const { data: metadataResponse, isLoading: metadataLoading } = useQuery({
    queryKey: ['config-metadata', 'all'],
    queryFn: () => api.listConfigMetadata(),
    enabled: isAuthenticated,
  });

  // Fetch global configuration values
  const {
    data: configResponse,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['config-values', 'global'],
    queryFn: () => api.listConfigValues({ scope: 'global' }),
    enabled: isAuthenticated,
  });

  const isSuperAdmin = user?.isSuperadmin === true;
  const isLoading = metadataLoading || configLoading;

  const metadata = metadataResponse?.data || [];
  const configs = configResponse?.data || [];

  // Access denied for non-super admins
  if (!isLoading && !isSuperAdmin) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only super administrators can access global configuration management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold">Global Configuration</h1>
          </div>
          <p className="text-muted-foreground">
            Manage system-wide configuration values. These settings apply to all organizations unless overridden.
          </p>
        </div>
        <Button onClick={() => refetchConfig()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Super Admin Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Super Admin Access</AlertTitle>
        <AlertDescription>
          You are viewing and editing global configuration values. Changes here will affect all organizations
          unless they have organization-specific overrides.
        </AlertDescription>
      </Alert>

      {/* Configuration Table */}
      <Card>
        <CardHeader>
          <CardTitle>Global Configuration Values</CardTitle>
          <CardDescription>
            Configure system-wide settings. Organization owners can override these values for their organizations.
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
              organizationId={null}
              scope="global"
              canEdit={isSuperAdmin}
              showInheritance={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Stats Card */}
      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metadata.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Available configuration keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Global Overrides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Values set at global level</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Using Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metadata.length - configs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Using metadata defaults</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
