/**
 * Login Page Component
 * Handles user authentication
 */

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Loader2, User, Lock, Sun, Moon, Mail, Shield } from 'lucide-react';
import { SocialLogin } from '@/components/SocialLogin';
import LoadingIndicator from '@/components/LoadingIndicator';
// Magic link: TODO - implement via API if needed

export default function Login() {
  const navigate = useNavigate();
  const { login, cloudLayerDevLogin, simulatedEmailLogin, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSocialAuthLoading, setIsSocialAuthLoading] = useState(false);
  const [isCloudLayerDevLoading, setIsCloudLayerDevLoading] = useState(false);
  const [socialProvider, setSocialProvider] = useState<'github' | 'google' | null>(null);

  // Magic link state
  const [useMagicLink, setUseMagicLink] = useState(true);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);

  // Initialize dark theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      // Don't navigate here - let the useEffect above handle navigation
      // This allows organization selection dialog to show and complete first
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLoadingChange = (loading: boolean, provider?: 'github' | 'google') => {
    setIsSocialAuthLoading(loading);
    setSocialProvider(loading ? provider ?? null : null);
  };

  const handleCloudLayerDevLogin = async () => {
    setError('');
    setIsCloudLayerDevLoading(true);

    try {
      await cloudLayerDevLogin(magicLinkEmail || username || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Local Cloud Layer dev login failed.');
    } finally {
      setIsCloudLayerDevLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsMagicLinkLoading(true);

    try {
      await simulatedEmailLogin(magicLinkEmail);
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulated email login failed. Please try again.');
    } finally {
      setIsMagicLinkLoading(false);
    }
  };

  const redirectLabel = socialProvider === 'google'
    ? 'Google'
    : socialProvider === 'github'
      ? 'GitHub'
      : 'your provider';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {isSocialAuthLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-colors dark:bg-black/80">
          <div className="rounded-lg bg-card px-6 py-5 text-foreground shadow-lg dark:bg-neutral-900 dark:text-white">
            <LoadingIndicator message={`Redirecting to ${redirectLabel}...`} size="lg" />
          </div>
        </div>
      )}
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5 text-foreground" />
          ) : (
            <Moon className="h-5 w-5 text-foreground" />
          )}
        </Button>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center"><span className="font-brand">PayIn</span> Admin</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Social Login */}
          <SocialLogin onLoadingChange={handleSocialLoadingChange} />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Login Mode Toggle */}
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant={useMagicLink ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setUseMagicLink(true);
                setError('');
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Magic Link
            </Button>
            <Button
              type="button"
              variant={!useMagicLink ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setUseMagicLink(false);
                setError('');
                setMagicLinkSent(false);
              }}
            >
              Password
            </Button>
          </div>

          {/* Form Container with Fixed Height */}
          <div className="min-h-[220px]">
            {/* Magic Link Login */}
            {useMagicLink ? (
              magicLinkSent ? (
                <div className="space-y-5">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 text-center space-y-2">
                    <Mail className="mx-auto h-10 w-10 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Simulated login complete
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Signed in as <strong>{magicLinkEmail}</strong> for the Railway proof environment.
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      No email was sent; the server created a proof-environment session cookie and a safe browser preview.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMagicLinkSent(false);
                      setMagicLinkEmail('');
                    }}
                  >
                    Try another email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMagicLinkSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="magic-email" className="text-sm font-medium text-foreground block">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="magic-email"
                        type="email"
                        placeholder="Enter your email"
                        value={magicLinkEmail}
                        onChange={(e) => setMagicLinkEmail(e.target.value)}
                        disabled={isMagicLinkLoading}
                        required
                        autoComplete="email"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Railway proof mode simulates email login without sending real email
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 dark:bg-red-950/50">
                      <p className="text-sm text-destructive dark:text-red-200">{error}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isMagicLinkLoading}>
                    {isMagicLinkLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending magic link...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Magic Link
                      </>
                    )}
                  </Button>

                  {/* Security Notice */}
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Secure passwordless authentication</span>
                  </div>
                </form>
              )
            ) : (
              /* Username/Password Login */
              <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-foreground block">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="username"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                    className="pl-10"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/15 p-3 dark:bg-red-950/50">
                  <p className="text-sm text-destructive dark:text-red-200">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-amber-500/60 bg-amber-500/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cloud Layer proof shell</p>
              <p className="text-xs text-muted-foreground">
                Uses simulated email/session login when provided; the local-dev button remains for deterministic smoke tests only.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleCloudLayerDevLogin}
              disabled={isCloudLayerDevLoading}
            >
              {isCloudLayerDevLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting local shell...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Enter Deterministic Local Shell
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
