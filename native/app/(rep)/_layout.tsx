import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../src/contexts/ThemeContext';
import { trainingApi } from '../../src/services/api';

function TabsLayout() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  // Fetch training progress to check training status
  const { data: trainingData, isLoading, isSuccess } = useQuery({
    queryKey: ['training-progress'],
    queryFn: async () => {
      const response = await trainingApi.getProgress();
      console.log('[RepLayout] Training progress response:', response);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    staleTime: 0, // Always refetch to get fresh training status
    refetchOnMount: true,
  });

  // Only determine training status when we have successfully loaded data
  const trainingCompleted = isSuccess && trainingData ? trainingData.training_completed : null;
  const currentScreen = segments[segments.length - 1];

  console.log('[RepLayout] State:', { isLoading, isSuccess, trainingCompleted, currentScreen, hasData: !!trainingData });

  // Redirect to training if not completed and trying to access other screens
  useEffect(() => {
    // Only redirect when we have definitive data that training is NOT complete
    if (isSuccess && trainingCompleted === false && currentScreen !== 'training') {
      console.log('[RepLayout] Training not completed, redirecting to training');
      router.replace('/(rep)/training');
    }
  }, [isSuccess, trainingCompleted, currentScreen, router]);

  // Show loading while checking training status
  if (isLoading || trainingCompleted === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If training not completed, only show training screen (no tabs)
  if (trainingCompleted === false) {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' }, // Hide tab bar
        }}
      >
        <Tabs.Screen
          name="training"
          options={{
            title: 'Training',
          }}
        />
        {/* Hide all other screens */}
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="deals" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="coaching" options={{ href: null }} />
      </Tabs>
    );
  }

  // Normal layout with all tabs when training is completed
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: isDark ? colors.background : '#FFFFFF',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="deals"
        options={{
          title: 'My Pipeline',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'My Map',
          tabBarIcon: ({ color, size }) => <Ionicons name="location" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          href: null, // Hide from tab bar - accessed via profile
        }}
      />
      <Tabs.Screen
        name="coaching"
        options={{
          href: null, // Hide from tab bar - accessed via profile
        }}
      />
    </Tabs>
  );
}

export default function RepLayout() {
  return <TabsLayout />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

