import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';

interface RpcProviderInfo {
  name: string;
  chains: string[];
  weight: number;
  rateLimit: number;
}

interface RpcProviderCardProps {
  provider: string;
  info: RpcProviderInfo;
}

export function RpcProviderCard({ provider, info }: RpcProviderCardProps) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="bg-primary p-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-1">{provider}</h3>
            <p className="text-sm text-primary-foreground/80">{info.name}</p>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30">
            Weight: {info.weight}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Rate Limit */}
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Rate Limit</div>
          <div className="text-lg font-bold text-foreground">{info.rateLimit} req/s</div>
        </div>

        {/* Supported Chains */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Supported Chains
          </label>
          <div className="space-y-2">
            {info.chains.map((chain: string) => (
              <div key={chain} className="flex items-center text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                {chain}
              </div>
            ))}
          </div>
        </div>

        {/* API Key Status */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center text-xs text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            <span>API Key configured and active</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
