import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  helpHref: string;
  helpLabel?: string;
  className?: string;
  iconClassName?: string;
  iconWrapperClassName?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  helpHref,
  helpLabel = 'View guide',
  className,
  iconClassName,
  iconWrapperClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary',
          iconWrapperClassName,
        )}
      >
        <Icon className={cn('h-6 w-6', iconClassName)} />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          {description}
        </p>
      </div>
      {action ? <div>{action}</div> : null}
      <Button variant="link" size="sm" asChild>
        <a href={helpHref} target="_blank" rel="noreferrer noopener">
          {helpLabel}
        </a>
      </Button>
    </div>
  );
}
