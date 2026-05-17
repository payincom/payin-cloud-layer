/**
 * Social Login Component
 * Handles OAuth login with GitHub and Google directly (no Supabase)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type SocialProvider = 'github' | 'google';

interface OAuthConfig {
  google: { clientId: string } | null;
  github: { clientId: string } | null;
}

interface SocialLoginProps {
  onLoadingChange?: (isLoading: boolean, provider?: SocialProvider) => void;
}

export function SocialLogin({ onLoadingChange }: SocialLoginProps) {
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<OAuthConfig | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || '/api/v1';

  useEffect(() => {
    fetch(`${apiUrl}/auth/oauth/config`)
      .then(r => r.json())
      .then(r => { if (r.success) setConfig(r.data); })
      .catch(() => {});
  }, [apiUrl]);

  const handleOAuth = (provider: SocialProvider) => {
    setError('');
    if (provider === 'github') {
      setIsGitHubLoading(true);
      onLoadingChange?.(true, 'github');
    } else {
      setIsGoogleLoading(true);
      onLoadingChange?.(true, 'google');
    }

    const frontendUrl = window.location.origin;
    window.location.href = `${apiUrl}/auth/oauth/${provider}?frontend_url=${encodeURIComponent(frontendUrl)}`;
  };

  // Don't render anything if config not loaded or no providers
  if (!config || (!config.google && !config.github)) return null;

  return (
    <div className="space-y-3">
      {config.github && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleOAuth('github')}
          disabled={isGitHubLoading || isGoogleLoading}
        >
          {isGitHubLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary dark:text-white" />
              Connecting to GitHub...
            </>
          ) : (
            <>
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </>
          )}
        </Button>
      )}

      {config.google && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleOAuth('google')}
          disabled={isGitHubLoading || isGoogleLoading}
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary dark:text-white" />
              Connecting to Google...
            </>
          ) : (
            <>
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </>
          )}
        </Button>
      )}

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 dark:bg-red-950/50">
          <p className="text-sm text-destructive dark:text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
