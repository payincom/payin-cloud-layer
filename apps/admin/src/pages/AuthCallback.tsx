/**
 * OAuth Callback Page
 * Handles the OAuth callback (token received via URL params from API)
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OrganizationSelector } from '@/components/OrganizationSelector';
import LoadingScreen from '@/components/LoadingScreen';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberStatus: string;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'org-select' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your login...');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isNewUser, setIsNewUser] = useState(false);
  const hasRun = useRef(false);

  const selectOrganization = (userOrgs: Organization[]): Organization | null => {
    if (!userOrgs || userOrgs.length === 0) return null;
    if (userOrgs.length === 1) return userOrgs[0];
    const lastOrgId = localStorage.getItem('last_organization_id');
    if (lastOrgId) {
      const lastOrg = userOrgs.find(org => org.id === lastOrgId);
      if (lastOrg) return lastOrg;
    }
    return null;
  };

  const finalizeLogin = (org: Organization) => {
    api.setOrganizationId(org.id);
    localStorage.setItem('last_organization_id', org.id);
    setStatus('success');
    setMessage(isNewUser ? 'Welcome! Account created successfully.' : 'Login successful!');
    setTimeout(() => { window.location.href = '/'; }, 1500);
  };

  const handleOrganizationSelect = (orgId: string) => {
    const selectedOrg = organizations.find(org => org.id === orgId);
    if (selectedOrg) finalizeLogin(selectedOrg);
  };

  const handleLogout = async () => {
    api.clearToken();
    api.clearOrganizationId();
    navigate('/login');
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        // Clear old org context
        api.clearOrganizationId();
        localStorage.removeItem('last_organization_id');

        // Check for error
        const error = searchParams.get('error');
        if (error) {
          setStatus('error');
          setMessage(decodeURIComponent(error));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Get token from URL (set by API OAuth callback redirect)
        const token = searchParams.get('token');
        const newUser = searchParams.get('isNewUser') === 'true';

        if (!token) {
          setStatus('error');
          setMessage('Authentication failed. No token received.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Save token
        api.setToken(token);
        setIsNewUser(newUser);

        // Fetch organizations
        const orgsResponse = await api.listOrganizations();
        if (!orgsResponse.organizations || orgsResponse.organizations.length === 0) {
          setStatus('error');
          setMessage('No organizations found for this user');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        const userOrgs = orgsResponse.organizations;
        const selectedOrg = selectOrganization(userOrgs);

        if (selectedOrg) {
          finalizeLogin(selectedOrg);
        } else {
          setOrganizations(userOrgs);
          setStatus('org-select');
          setMessage('Please select an organization');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <>
      {status === 'loading' ? (
        <LoadingScreen message={message} />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 dark:bg-black">
          <Card className="w-full max-w-md border border-border bg-card text-foreground dark:border-white/10 dark:bg-neutral-950 dark:text-white">
            <CardHeader>
              <CardTitle className="text-center text-foreground dark:text-white">
                {status === 'org-select' && 'Select Organization'}
                {status === 'success' && 'Success!'}
                {status === 'error' && 'Error'}
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground dark:text-neutral-300">
                {message}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-500 dark:text-emerald-300" />}
              {status === 'error' && <XCircle className="h-12 w-12 text-destructive dark:text-red-300" />}
            </CardContent>
          </Card>
        </div>
      )}
      <OrganizationSelector
        open={status === 'org-select'}
        organizations={organizations}
        onSelect={handleOrganizationSelect}
        onLogout={handleLogout}
      />
    </>
  );
}
