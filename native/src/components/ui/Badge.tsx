import React from 'react';
import { View, Text } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'flex-row items-center justify-center rounded-full px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        secondary: 'bg-gray-200',
        destructive: 'bg-red-500',
        outline: 'border border-gray-300 bg-transparent',
        success: 'bg-green-500',
        warning: 'bg-amber-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const textVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-white',
      secondary: 'text-gray-800',
      destructive: 'text-white',
      outline: 'text-gray-800',
      success: 'text-white',
      warning: 'text-white',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, variant, className }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      {typeof children === 'string' ? (
        <Text className={textVariants({ variant })}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}
