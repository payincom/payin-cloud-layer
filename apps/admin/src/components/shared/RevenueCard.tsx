import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useRevenueDisplayMode } from '@/hooks/useRevenueDisplayMode';

/**
 * RevenueCard Component
 * Displays revenue amounts with integrated display mode toggle
 */
export function RevenueCard({
  title,
  amounts,
  icon,
  trend,
  trendUp,
}: {
  title: string;
  amounts: Record<string, number>;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}) {
  const { mode: displayMode, setMode } = useRevenueDisplayMode();

  // Sort tokens by amount (descending)
  const tokens = Object.entries(amounts).sort((a, b) => b[1] - a[1]);
  const totalUSD = Object.values(amounts).reduce((sum, v) => sum + v, 0);
  const isMerged = displayMode === 'merged';

  return (
    <Card className="p-6 border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              trendUp ? 'text-green-500' : 'text-red-500'
            }`}>
              {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="display-mode-toggle" className="text-xs text-muted-foreground cursor-pointer">
              Merged
            </Label>
            <Switch
              id="display-mode-toggle"
              checked={isMerged}
              onCheckedChange={(checked) => setMode(checked ? 'merged' : 'separate')}
            />
          </div>
        </div>
      </div>

      {isMerged ? (
        // Merged Mode: Show total USD with token badges
        totalUSD > 0 ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-sm font-medium text-muted-foreground">USD</span>
            </div>
            {tokens.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tokens.map(([token, amount]) => (
                  <Badge key={token} variant="secondary" className="text-xs">
                    {token}: ${amount.toFixed(2)}
                  </Badge>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-3xl font-bold text-muted-foreground">$0.00 USD</div>
        )
      ) : (
        // Separate Mode: Show each token with equal visual weight
        tokens.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {tokens.map(([token, amount]) => (
              <div
                key={token}
                className="p-3 rounded-lg bg-muted/50 border border-border"
              >
                <div className="text-xs text-muted-foreground mb-1">{token}</div>
                <div className="text-xl font-bold text-foreground">
                  ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-3xl font-bold text-muted-foreground">No tokens</div>
        )
      )}
    </Card>
  );
}
