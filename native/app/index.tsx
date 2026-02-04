import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  console.log('[Index] State:', { loading, hasUser: !!user, role });

  useEffect(() => {
    if (loading) {
      console.log('[Index] Still loading...');
      return;
    }

    console.log('[Index] Loading complete, navigating...', { user: !!user, role });

    if (!user) {
      console.log('[Index] No user, going to login');
      router.replace('/(auth)/login');
    } else if (role === 'admin') {
      console.log('[Index] Admin user, going to admin dashboard');
      router.replace('/(admin)/dashboard');
    } else if (role === 'rep') {
      console.log('[Index] Rep user, going to rep dashboard');
      router.replace('/(rep)/dashboard');
    } else {
      console.log('[Index] No role, going to login');
      router.replace('/(auth)/login');
    }
  }, [user, role, loading, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#C9A24D" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1E2E',
  },
});

