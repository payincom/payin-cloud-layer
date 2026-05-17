import LoadingIndicator from './LoadingIndicator';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background text-foreground transition-colors">
      <LoadingIndicator message={message} size="lg" />
    </div>
  );
}

export default LoadingScreen;
