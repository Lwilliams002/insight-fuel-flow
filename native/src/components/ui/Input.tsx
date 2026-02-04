import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { cn } from '../../lib/utils';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  containerClassName,
  className,
  ...props
}: InputProps) {
  return (
    <View className={cn('w-full', containerClassName)}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>
      )}
      <TextInput
        className={cn(
          'w-full h-12 px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-900',
          'focus:border-primary',
          error && 'border-red-500',
          className
        )}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
}
