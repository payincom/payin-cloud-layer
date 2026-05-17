/**
 * GlobalConfigSection Component
 * Global configuration management section for super admins
 */

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfigTable } from '@/components/config-management/ConfigTable';

export function GlobalConfigSection() {
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

  return (
    <div className="space-y-6">
      {/* Configuration Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Configuration Values</CardTitle>
              <CardDescription>
                Configure system-wide settings. Organization owners can override these values for their organizations.
              </CardDescription>
            </div>
            <Button onClick={() => refetchConfig()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
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
              <CardTitle className="text-sm font-medium text-foreground">Total Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metadata.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Available configuration keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Global Overrides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{configs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Values set at global level</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Using Defaults</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metadata.length - configs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Using metadata defaults</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
