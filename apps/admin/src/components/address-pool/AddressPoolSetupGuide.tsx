import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type GuideContext = 'dashboard' | 'payment-links' | 'orders' | 'deposits';

interface AddressPoolSetupGuideProps {
  context: GuideContext;
  className?: string;
}

const COPY: Record<
  GuideContext,
  {
    alert: string;
    cardTitle: string;
    cardDescription: string;
    steps: string[];
    successHint: string;
  }
> = {
  'dashboard': {
    alert: 'Dashboard metrics stay empty until your organization has at least one address in the pool.',
    cardTitle: 'Import addresses to unlock dashboard insights',
    cardDescription:
      'The dashboard consolidates live payment and deposit activity. Populate the address pool so new transactions can appear here.',
    steps: [
      'Open the Address Pool and switch to the Addresses tab.',
      'Use “Import Addresses” to upload EVM or Tron receiving addresses.',
      'Wait for the confirmation toast, then return to the dashboard to monitor activity.',
    ],
    successHint: 'You can come back any time to top up the pool as demand grows.',
  },
  'payment-links': {
    alert: 'Payment links need available pool addresses before they can assign checkout destinations.',
    cardTitle: 'Import addresses before creating your first link',
    cardDescription:
      'Each published payment link reserves an address from the pool. Without inventory the creation flow will fail.',
    steps: [
      'Head to the Address Pool and go to the Addresses tab.',
      'Import a batch of addresses for the chains you plan to accept.',
      'Return here to create and publish payment links instantly.',
    ],
    successHint: 'Links will auto-allocate from the pool and release addresses when orders complete.',
  },
  'orders': {
    alert: 'Orders allocate payment addresses from the pool when customers check out.',
    cardTitle: 'Prepare the address pool to start taking orders',
    cardDescription:
      'Without available addresses the order flow cannot assign payment destinations, leaving customers blocked.',
    steps: [
      'Navigate to Address Pool → Addresses.',
      'Import fresh addresses for the supported protocols (EVM, Tron, etc.).',
      'Monitor the pool health so there is always inventory for new orders.',
    ],
    successHint: 'Once addresses are imported you can create and confirm orders without interruptions.',
  },
  'deposits': {
    alert: 'Deposit references bind addresses from the pool for each end user.',
    cardTitle: 'Populate the pool to enable deposit monitoring',
    cardDescription:
      'Binding a user to a deposit address requires available inventory in the address pool.',
    steps: [
      'Open the Address Pool and switch to the Addresses tab.',
      'Import or paste the addresses allocated for deposits.',
      'Assign them to deposit references from this page once the pool is ready.',
    ],
    successHint: 'Keep a buffer of unused addresses so new users can be onboarded immediately.',
  },
};

export function AddressPoolSetupGuide({ context, className }: AddressPoolSetupGuideProps) {
  const navigate = useNavigate();
  const copy = COPY[context];

  const handleNavigate = () => {
    navigate('/address-pool', { state: { focusTab: 'overview' } });
  };

  return (
    <div className={cn('space-y-6', className)}>
      <Alert className="border-l-4 border-l-amber-500 bg-amber-50/80 dark:bg-amber-500/10 dark:text-amber-100">
        <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-300" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <AlertTitle className="text-base font-semibold text-amber-800 dark:text-amber-100">
              Address required to receive transfers
            </AlertTitle>
            <AlertDescription className="text-sm text-amber-800/90 dark:text-amber-100/80">
              {copy.alert}
            </AlertDescription>
          </div>
          <Button onClick={handleNavigate} className="w-full sm:w-auto gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4" />
            Import addresses now
          </Button>
        </div>
      </Alert>

      <Card className="border border-dashed border-amber-200 bg-background/80 dark:border-amber-400/40">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">
            {copy.cardTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{copy.cardDescription}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm text-muted-foreground">
            {copy.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
            <span>{copy.successHint}</span>
          </div>

          <div className="pt-2">
            <Button onClick={handleNavigate} className="gap-2">
              <Plus className="w-4 h-4" />
              Import addresses now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
