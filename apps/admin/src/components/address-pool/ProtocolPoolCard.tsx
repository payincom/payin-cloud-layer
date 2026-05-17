import { useState } from 'react';
import { Database, Upload, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImportAddressesModal } from './ImportAddressesModal';
import { toast } from 'sonner';

interface ProtocolPoolCardProps {
  protocol: string;
  displayName: string;
  total: number;
  available: number;
  allocated: number;
  bound: number;
  coolingDown: number;
  onImportSuccess?: () => void;
}

/**
 * Protocol Pool Card Component
 * Displays overview statistics for a single protocol's address pool
 */
export function ProtocolPoolCard({
  protocol,
  displayName,
  total,
  available,
  allocated,
  bound,
  coolingDown,
  onImportSuccess,
}: ProtocolPoolCardProps) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const readyToUse = available - coolingDown;
  const inUse = allocated + bound;

  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info('Export functionality coming soon!');
  };

  // Calculate percentages for distribution bar
  const boundRate = total > 0 ? (bound / total) * 100 : 0;
  const allocatedRate = total > 0 ? (allocated / total) * 100 : 0;
  const coolingRate = total > 0 ? (coolingDown / total) * 100 : 0;
  const readyRate = total > 0 ? (readyToUse / total) * 100 : 0;

  return (
    <Card className="border-border bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            {displayName} Pool
          </h3>
          <Badge variant="outline" className="text-xs">
            {protocol.toUpperCase()}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <StatItem label="Total" value={total} />
          <StatItem label="Cooling" value={coolingDown} />
          <StatItem label="In Use" value={inUse} />
          <StatItem label="Available" value={readyToUse} highlight={readyToUse > 0} />
        </div>

        {/* In Use Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border pt-3">
          <div>
            <span className="text-muted-foreground">Allocated:</span>{' '}
            <span className="font-medium text-foreground">{allocated}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Bound:</span>{' '}
            <span className="font-medium text-foreground">{bound}</span>
          </div>
        </div>

        {/* Distribution Bar */}
        <div>
          <div className="w-full bg-muted rounded-lg h-3 flex overflow-hidden">
            {bound > 0 && (
              <div
                className="bg-purple-500"
                style={{ width: `${boundRate}%` }}
                title={`Bound: ${bound} (${boundRate.toFixed(1)}%)`}
              />
            )}
            {allocated > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${allocatedRate}%` }}
                title={`Allocated: ${allocated} (${allocatedRate.toFixed(1)}%)`}
              />
            )}
            {coolingDown > 0 && (
              <div
                className="bg-orange-500"
                style={{ width: `${coolingRate}%` }}
                title={`Cooling: ${coolingDown} (${coolingRate.toFixed(1)}%)`}
              />
            )}
            {readyToUse > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${readyRate}%` }}
                title={`Available: ${readyToUse} (${readyRate.toFixed(1)}%)`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded" />
              <span className="text-muted-foreground">Bound: {bound}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded" />
              <span className="text-muted-foreground">Allocated: {allocated}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-orange-500 rounded" />
              <span className="text-muted-foreground">Cooling: {coolingDown}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-green-500 rounded" />
              <span className="text-muted-foreground">Available: {readyToUse}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Import Modal */}
        <ImportAddressesModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          protocol={protocol}
          displayName={displayName}
          onImportSuccess={onImportSuccess}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Stat Item Component
 * Individual statistic display in the stats grid
 */
function StatItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-2 rounded-lg border transition-colors ${
        highlight
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/50 border-border'
      }`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold mt-0.5 ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
