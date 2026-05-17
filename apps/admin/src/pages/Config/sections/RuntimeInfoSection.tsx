/**
 * RuntimeInfoSection Component
 * Display runtime information including chains, tokens, and full configuration
 */

import { useQuery } from '@tanstack/react-query';
import { Link2, Coins, Settings, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function RuntimeInfoSection() {
  const { isAuthenticated } = useAuth();

  // Fetch runtime configuration
  const { data: runtimeConfig, isLoading: runtimeLoading } = useQuery({
    queryKey: ['config', 'runtime'],
    queryFn: () => api.getRuntimeConfig(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Fetch chains
  const { data: chains, isLoading: chainsLoading } = useQuery({
    queryKey: ['chains'],
    queryFn: () => api.listChains(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Fetch tokens
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.listTokens(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  return (
    <Tabs defaultValue="chains" className="w-full">
      <TabsList>
        <TabsTrigger value="chains">Chains</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="config">Full Configuration</TabsTrigger>
      </TabsList>

      {/* Chains Tab */}
      <TabsContent value="chains" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chainsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            chains?.data?.map((chain: any) => (
              <Card key={chain.chainId}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <span className="text-foreground">{chain.name}</span>
                    </div>
                    {chain.syncStatus ? (
                      <Badge variant="default" className="bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Inactive
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {chain.chainId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Protocol:</span>
                    <span className="font-medium text-foreground uppercase">{chain.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-medium text-foreground capitalize">{chain.network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confirmations:</span>
                    <span className="font-medium text-foreground">{chain.confirmations}</span>
                  </div>
                  {chain.syncStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latest Block:</span>
                      <span className="font-mono text-xs text-foreground">#{chain.syncStatus.latestProcessedBlock}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </TabsContent>

      {/* Tokens Tab */}
      <TabsContent value="tokens" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tokensLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            tokens?.tokens?.map((token: any) => (
              <Card key={token.symbol}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Coins className="w-5 h-5" />
                    <span className="text-foreground">{token.symbol}</span>
                  </CardTitle>
                  <CardDescription>{token.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Decimals:</span>
                    <span className="font-medium text-foreground">{token.decimals}</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Contract Addresses:</p>
                    <div className="space-y-2">
                      {token.chains?.map((chain: any) => (
                        <div key={chain.chainId} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{chain.chainId}</p>
                          <p className="font-mono text-xs bg-muted/50 p-2 rounded break-all text-foreground">
                            {chain.contractAddress}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </TabsContent>

      {/* Full Configuration Tab */}
      <TabsContent value="config" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <span className="text-foreground">Runtime Configuration</span>
            </CardTitle>
            <CardDescription>
              Complete system configuration (read-only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runtimeLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Source</p>
                    <p className="font-mono text-sm bg-muted p-3 rounded text-foreground">
                      {runtimeConfig?.data?.source}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Last Updated</p>
                    <p className="font-mono text-sm bg-muted p-3 rounded text-foreground">
                      {new Date(runtimeConfig?.data?.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Full Configuration (JSON)</p>
                  <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-96 border text-foreground">
                    {JSON.stringify(runtimeConfig?.data?.merged, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
