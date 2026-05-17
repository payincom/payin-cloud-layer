/**
 * ConfigInheritanceBadge Component
 * Displays a badge indicating the source of a configuration value
 */

import { Badge } from '@/components/ui/badge';
import { Globe, Building2, FileText } from 'lucide-react';

interface ConfigInheritanceBadgeProps {
  source: 'global' | 'organization' | 'metadata';
  className?: string;
}

export function ConfigInheritanceBadge({ source, className }: ConfigInheritanceBadgeProps) {
  const badges = {
    global: {
      icon: Globe,
      label: 'Global',
      variant: 'default' as const,
    },
    organization: {
      icon: Building2,
      label: 'Organization',
      variant: 'secondary' as const,
    },
    metadata: {
      icon: FileText,
      label: 'Default',
      variant: 'outline' as const,
    },
  };

  const config = badges[source];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}
