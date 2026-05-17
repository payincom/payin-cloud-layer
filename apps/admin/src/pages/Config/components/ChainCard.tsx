import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ChainCardProps {
  chain: {
    chainId: string;
    name: string;
    network: string;
    protocol: string;
    confirmations: number;
    syncStatus?: {
      latestProcessedBlock: number;
      syncStatus: string;
      isHealthy: boolean;
      behindBlocks: number;
    };
  };
  providers: string[];
}

export function ChainCard({ chain, providers }: ChainCardProps) {
  return (
    <Card className="p-6 border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{chain.name}</h3>
          <p className="text-sm text-muted-foreground font-mono">{chain.chainId}</p>
        </div>
        <Badge variant={chain.network === 'mainnet' ? 'default' : 'secondary'}>
          {chain.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-sm text-muted-foreground">Protocol</span>
          <Badge variant="outline">{chain.protocol.toUpperCase()}</Badge>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-sm text-muted-foreground">Required Confirmations</span>
          <span className="text-sm font-semibold text-foreground">{chain.confirmations} blocks</span>
        </div>

        {/* Sync Status */}
        {chain.syncStatus && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Latest Block</span>
              <span className="text-sm font-semibold text-primary font-mono">
                #{chain.syncStatus.latestProcessedBlock}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Sync Status</span>
              <Badge variant={chain.syncStatus.syncStatus === 'synced' ? 'default' : 'secondary'}>
                {chain.syncStatus.isHealthy ? '✓' : '✗'} {chain.syncStatus.syncStatus}
              </Badge>
            </div>
            {chain.syncStatus.behindBlocks > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Behind Blocks</span>
                <span className="text-sm font-semibold text-orange-600">
                  {chain.syncStatus.behindBlocks}
                </span>
              </div>
            )}
          </>
        )}

        {/* RPC Providers */}
        {providers.length > 0 && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              RPC Providers
            </label>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider: string, index: number) => (
                <Badge key={provider} variant="outline">
                  {index + 1}. {provider}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
