import { Loader2 } from 'lucide-react';

type LoadingIndicatorSize = 'sm' | 'md' | 'lg';

interface LoadingIndicatorProps {
  message?: string;
  size?: LoadingIndicatorSize;
}

const sizeClasses: Record<LoadingIndicatorSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingIndicator({ message, size = 'md' }: LoadingIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-foreground">
      <Loader2
        aria-label="Loading"
        className={`${sizeClasses[size]} animate-spin text-current`}
      />
      {message ? (
        <p className="text-sm text-current">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export default LoadingIndicator;
