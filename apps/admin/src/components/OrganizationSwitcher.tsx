/**
 * Organization Switcher Component
 * Allows users to switch between organizations they belong to
 */

import { useState } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function OrganizationSwitcher() {
  const { organization, organizations, switchOrganization } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Don't show if user has no organizations or only one organization
  if (!organization || organizations.length <= 1) {
    return null;
  }

  const handleSwitch = async (orgId: string) => {
    if (orgId === organization.id || isLoading) return;

    setIsLoading(true);
    try {
      await switchOrganization(orgId);
    } catch (error) {
      console.error('Failed to switch organization:', error);
      setIsLoading(false);
    }
  };

  // Get role display text with proper capitalization
  const getRoleDisplay = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3"
          disabled={isLoading}
        >
          <Building2 className="h-4 w-4 text-foreground" />
          <span className="max-w-[150px] truncate text-foreground">{organization.name}</span>
          <ChevronDown className="h-4 w-4 text-foreground opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={organization.id}>
          {organizations.map((org) => (
            <DropdownMenuRadioItem
              key={org.id}
              value={org.id}
              onClick={() => handleSwitch(org.id)}
              disabled={isLoading}
              className="cursor-pointer"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{org.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {getRoleDisplay(org.role)}
                  </div>
                </div>
                {org.id === organization.id && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
