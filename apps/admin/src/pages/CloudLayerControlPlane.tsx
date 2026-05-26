import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, Building2, KeyRound, RefreshCw, ShieldCheck, Terminal } from 'lucide-react';
import { api } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const refreshIntervalMs = 10_000;

export default function CloudLayerControlPlane() {
  const status = useQuery({
    queryKey: ['cloud-layer-control-plane', 'status'],
    queryFn: () => api.getCloudLayerControlPlaneStatus(),
    refetchInterval: refreshIntervalMs,
  });

  const currentOrg = useQuery({
    queryKey: ['cloud-layer-control-plane', 'org-current'],
    queryFn: () => api.getCloudLayerCurrentOrg(),
    refetchInterval: refreshIntervalMs,
  });

  const apiKeys = useQuery({
    queryKey: ['cloud-layer-control-plane', 'api-keys'],
    queryFn: () => api.listCloudLayerControlPlaneApiKeys(),
    refetchInterval: refreshIntervalMs,
  });

  const entitlements = useQuery({
    queryKey: ['cloud-layer-control-plane', 'entitlements'],
    queryFn: () => api.getCloudLayerEntitlementsStatus(),
    refetchInterval: refreshIntervalMs,
  });

  const createApiKey = useMutation({
    mutationFn: () => api.createCloudLayerControlPlaneApiKey('Admin UI Local Preview'),
    onSuccess: async () => {
      await Promise.all([apiKeys.refetch(), entitlements.refetch(), status.refetch()]);
    },
  });

  const isLoading = status.isLoading || currentOrg.isLoading || apiKeys.isLoading || entitlements.isLoading;
  const error = status.error || currentOrg.error || apiKeys.error || entitlements.error;

  const refreshAll = async () => {
    await Promise.all([
      status.refetch(),
      currentOrg.refetch(),
      apiKeys.refetch(),
      entitlements.refetch(),
    ]);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Cloud Layer Control Plane</h1>
              <p className="text-sm text-muted-foreground">
                Local SaaS shell loop backed by Cloud-owned `/api/v1/cloud-layer/control-plane/*` routes.
              </p>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={refreshAll} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Alert className="border-amber-500/50 bg-amber-500/10">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Local-dev only</AlertTitle>
        <AlertDescription>
          This panel intentionally demonstrates deterministic in-memory Cloud Layer SaaS behavior. It never displays API key secrets; previews and checksums are safe metadata only.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Control plane unavailable</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : 'Unable to load Cloud Layer control-plane data.'}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Status
                </CardTitle>
                <CardDescription>Runtime health and mode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <Badge variant="secondary">{status.data?.provider ?? 'unknown'}</Badge>
                </div>
                <InfoRow label="Mode" value={status.data?.mode ?? 'unknown'} />
                <InfoRow label="Storage" value={status.data?.storage ?? 'unknown'} />
                <InfoRow label="Production security" value={status.data?.productionSecurity ? 'enabled' : 'disabled'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Current Org
                </CardTitle>
                <CardDescription>Tenant resolved by local control plane</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Name" value={currentOrg.data?.organization.name ?? 'unknown'} />
                <InfoRow label="Org ID" value={currentOrg.data?.organization.id ?? 'unknown'} />
                <InfoRow label="Slug" value={currentOrg.data?.organization.slug ?? 'unknown'} />
                <InfoRow label="Tenant source" value={currentOrg.data?.tenant.source ?? 'unknown'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-primary" />
                  API Key Previews
                </CardTitle>
                <CardDescription>No secret material is returned</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Organization" value={apiKeys.data?.organizationId ?? 'unknown'} />
                <InfoRow label="Preview count" value={String(apiKeys.data?.apiKeys.length ?? 0)} />
                <InfoRow label="Secret display" value="never" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entitlements</CardTitle>
              <CardDescription>{entitlements.data?.evaluation ?? 'deterministic-local-allowlist'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(entitlements.data?.entitlements ?? []).map(entitlement => (
                  <div key={entitlement.feature} className="rounded-lg border bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{entitlement.feature}</p>
                      <Badge variant={entitlement.granted ? 'default' : 'destructive'}>
                        {entitlement.granted ? 'Granted' : 'Denied'}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <InfoRow label="Used" value={String(entitlement.quota.used)} />
                      <InfoRow label="Limit" value={String(entitlement.quota.limit)} />
                      <InfoRow label="Remaining" value={String(entitlement.quota.remaining)} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>API Key Metadata</CardTitle>
                <CardDescription>Safe previews only; full tokens are not generated or displayed in this UI.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => createApiKey.mutate()}
                disabled={createApiKey.isPending}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {createApiKey.isPending ? 'Creating preview...' : 'Create Local Preview'}
              </Button>
            </CardHeader>
            <CardContent>
              {(apiKeys.data?.apiKeys.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No local API key previews yet. Create one with the M4 control-plane API to see quota usage update here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-4 font-medium">Label</th>
                        <th className="py-2 pr-4 font-medium">Preview</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Checksum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.data?.apiKeys.map(apiKey => (
                        <tr key={apiKey.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 text-foreground">{apiKey.label}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{apiKey.preview}</td>
                          <td className="py-3 pr-4"><Badge variant="outline">{apiKey.status}</Badge></td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{apiKey.checksum}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
