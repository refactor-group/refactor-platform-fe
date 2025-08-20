import React from 'react';
import { cn } from '@/components/lib/utils';
import { UserPresence } from '@/types/presence';

interface PresenceIndicatorProps {
  presence: UserPresence | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = React.memo(({
  presence,
  size = 'sm',
  className
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  
  // Automatic type narrowing with discriminated unions (no manual checks needed)
  const isConnected = presence?.status === 'connected';
  
  return (
    <span
      className={cn(
        'inline-block rounded-full transition-colors duration-200',
        sizeClasses[size],
        isConnected ? 'bg-green-500' : 'bg-gray-900 dark:bg-gray-700',
        className
      )}
      aria-label={isConnected ? 'Online' : 'Offline'}
      role="status"
    />
  );
});

PresenceIndicator.displayName = 'PresenceIndicator';