import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../../lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <View className={cn('h-2 w-full bg-gray-200 rounded-full overflow-hidden', className)}>
      <View
        className={cn('h-full bg-primary rounded-full', indicatorClassName)}
        style={{ width: `${percentage}%` }}
      />
    </View>
  );
}
