import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

interface TokenCardProps {
  token: {
    symbol: string;
    name: string;
    decimals: number;
    contracts: Record<string, string>;
  };
}

export function TokenCard({ token }: TokenCardProps) {
  const formatChainName = (chainId: string) => {
    return chainId
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <Card className="overflow-hidden border-border bg-card">
      <div className="bg-primary p-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-1">{token.symbol}</h3>
            <p className="text-primary-foreground/80">{token.name}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{token.decimals}</div>
            <div className="text-sm text-primary-foreground/80">decimals</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h4 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
          Contract Addresses
        </h4>
        <div className="space-y-3">
          {Object.entries(token.contracts).map(([chainId, address]) => (
            <div
              key={chainId}
              className="flex items-start justify-between p-3 bg-muted/30 rounded-lg hover:bg-accent/50 transition-colors border border-border"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground mb-1">
                  {formatChainName(chainId)}
                </div>
                <code className="text-xs font-mono text-muted-foreground break-all">
                  {address}
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(address)}
                title="Copy address"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
