import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRevenueDisplayMode } from '@/hooks/useRevenueDisplayMode';

/**
 * InlineRevenueCard Component
 * Compact version of RevenueCard for inline display in pages
 */
export function InlineRevenueCard({
  title,
  amounts,
  icon,
}: {
  title: string;
  amounts: Record<string, number>;
  icon: React.ReactNode;
}) {
  const { mode: displayMode, setMode } = useRevenueDisplayMode();

  // Sort tokens by amount (descending)
  const tokens = Object.entries(amounts).sort((a, b) => b[1] - a[1]);
  const totalUSD = Object.values(amounts).reduce((sum, v) => sum + v, 0);
  const isMerged = displayMode === 'merged';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="inline-display-toggle" className="text-xs text-muted-foreground cursor-pointer">
              Merged
            </Label>
            <Switch
              id="inline-display-toggle"
              checked={isMerged}
              onCheckedChange={(checked) => setMode(checked ? 'merged' : 'separate')}
            />
          </div>
        </div>
        {isMerged ? (
          // Merged mode: Show total USD with token badges
          Object.keys(amounts).length > 0 ? (
            <>
              <div className="text-2xl font-bold text-foreground">
                ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tokens.map(([token, amount]) => (
                  <Badge key={token} variant="secondary" className="text-xs">
                    {token}: ${amount.toFixed(2)}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">$0.00 USD</div>
          )
        ) : (
          // Separate mode: Show each token with equal visual weight, stacked vertically
          tokens.length > 0 ? (
            <div className="space-y-2">
              {tokens.map(([token, amount]) => (
                <div
                  key={token}
                  className="flex items-center justify-between p-2.5 rounded-md bg-muted/50 border border-border"
                >
                  <span className="text-sm font-medium text-muted-foreground">{token}</span>
                  <span className="text-lg font-bold text-foreground">
                    ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">$0.00</div>
          )
        )}
      </CardContent>
    </Card>
  );
}
