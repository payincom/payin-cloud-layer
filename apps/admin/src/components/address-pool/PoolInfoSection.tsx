import { Database, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Pool Info Section Component
 * Displays information about address pool states and terminology
 */
export function PoolInfoSection() {
  return (
    <Card className="p-6 border-border bg-muted/30">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Database className="w-4 h-4 text-primary" />
        Address Pool Information
      </h3>
      <ul className="text-sm text-muted-foreground space-y-2">
        <li className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
          <span>
            <strong className="text-foreground">Available:</strong> Addresses ready to be assigned to new orders or users
          </span>
        </li>
        <li className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
          <span>
            <strong className="text-foreground">Allocated:</strong> Addresses temporarily assigned to pending orders
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
          <span>
            <strong className="text-foreground">Bound:</strong> Addresses permanently bound to user deposit accounts
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 text-orange-500 flex-shrink-0" />
          <span>
            <strong className="text-foreground">Cooling:</strong> Recently released addresses in cooldown period (30 minutes default)
          </span>
        </li>
      </ul>
    </Card>
  );
}
