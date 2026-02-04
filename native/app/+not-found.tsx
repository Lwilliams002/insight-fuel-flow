import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Link, Stack, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../src/constants/config';

// Import logo directly
const logoImage = require('../assets/logo.png');

export default function NotFoundScreen() {
  const pathname = usePathname();

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Unmatched Route</Text>
          <Text style={styles.subtitle}>Page could not be found.</Text>

          {/* Path Display */}
          <View style={styles.pathContainer}>
            <Text style={styles.path} numberOfLines={2}>{pathname}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Link href="/" asChild>
              <TouchableOpacity style={styles.primaryButton}>
                <Ionicons name="arrow-back" size={18} color="#FFF" />
                <Text style={styles.primaryButtonText}>Go back</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(rep)/dashboard" asChild>
              <TouchableOpacity style={styles.secondaryButton}>
                <Ionicons name="home-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Dashboard</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1E2E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
  },
  pathContainer: {
    backgroundColor: '#1E2D3D',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 32,
    maxWidth: '100%',
  },
  path: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(201, 162, 77, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
