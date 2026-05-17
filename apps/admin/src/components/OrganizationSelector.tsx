/**
 * Organization Selection Dialog
 * Displayed when user belongs to multiple organizations and needs to choose one
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, ChevronRight, LogOut } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberStatus: string;
}

interface OrganizationSelectorProps {
  open: boolean;
  organizations: Organization[];
  onSelect: (orgId: string) => void;
  onLogout: () => void;
}

export function OrganizationSelector({ open, organizations, onSelect, onLogout }: OrganizationSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Organization
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            You belong to multiple organizations. Please select one to continue.
          </p>
          <div className="space-y-2 mb-4">
            {organizations.map((org) => (
              <Button
                key={org.id}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                onClick={() => onSelect(org.id)}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium">{org.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-center text-muted-foreground hover:text-destructive"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
