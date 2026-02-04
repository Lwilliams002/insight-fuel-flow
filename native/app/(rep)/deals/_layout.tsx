import { Stack } from 'expo-router';

export default function DealsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'My Pipeline',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Deal Details',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Deal',
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
