/**
 * SystemAdministrationTab Component
 * System-level settings for super admins including global config and runtime info
 */

import { Shield, Info, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GlobalConfigSection } from './sections/GlobalConfigSection';
import { RuntimeInfoSection } from './sections/RuntimeInfoSection';

export function SystemAdministrationTab() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperadmin === true;

  // Access denied for non-super admins
  if (!isSuperAdmin) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only super administrators can access system administration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">System Administration</h2>
        </div>
        <p className="text-muted-foreground">
          Manage system-wide settings and monitor runtime information.
          Changes here affect all organizations unless they have specific overrides.
        </p>
      </div>

      {/* Super Admin Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Super Admin Access</AlertTitle>
        <AlertDescription>
          You have full system access. Use caution when modifying global settings.
        </AlertDescription>
      </Alert>

      {/* Admin Sections */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList>
          <TabsTrigger value="global" className="gap-2">
            <Shield className="w-4 h-4" />
            Global Configuration
          </TabsTrigger>
          <TabsTrigger value="runtime" className="gap-2">
            <Info className="w-4 h-4" />
            Runtime Information
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-6">
          <GlobalConfigSection />
        </TabsContent>

        <TabsContent value="runtime" className="mt-6">
          <RuntimeInfoSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
