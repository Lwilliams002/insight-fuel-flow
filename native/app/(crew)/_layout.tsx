import { Stack } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function CrewLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="jobs/[id]" />
    </Stack>
  );
}

