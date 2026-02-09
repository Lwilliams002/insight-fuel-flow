import { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, completeNewPassword, newPasswordRequired, user, role } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<'admin' | 'rep' | 'crew' | null>(null);

  const accountTypes = [
    { value: 'rep' as const, label: 'Sales Rep', icon: 'person' as const },
    { value: 'admin' as const, label: 'Admin', icon: 'shield-checkmark' as const },
    { value: 'crew' as const, label: 'Crew', icon: 'construct' as const },
  ];

  // Navigate when user is authenticated
  useEffect(() => {
    if (user && role) {
      console.log('[Login] User authenticated, navigating to:', role);
      if (role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else if (role === 'rep') {
        router.replace('/(rep)/dashboard');
      } else if (role === 'crew') {
        router.replace('/(crew)/dashboard');
      }
    }
  }, [user, role, router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    const { error, newPasswordRequired: needsNewPassword } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to sign in');
      return;
    }
  };

  const handleNewPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const { error } = await completeNewPassword(newPassword);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to set new password');
      return;
    }
  };

  if (newPasswordRequired) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>
                You need to set a new password to continue
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleNewPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Set Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.titleRow}>
              <Text style={styles.logoTextGold}>PRIME</Text>
              <Text style={styles.logoTextWhite}> PROS</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Account Type Selection - Always visible */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Select Account Type</Text>
              <View style={styles.accountTypeCards}>
                {accountTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.accountTypeCard,
                      selectedAccountType === type.value && styles.accountTypeCardActive
                    ]}
                    onPress={() => setSelectedAccountType(type.value)}
                  >
                    <View style={[
                      styles.accountTypeIconContainer,
                      selectedAccountType === type.value && styles.accountTypeIconContainerActive
                    ]}>
                      <Ionicons
                        name={type.icon}
                        size={24}
                        color={selectedAccountType === type.value ? "#C9A24D" : "#6B7280"}
                      />
                    </View>
                    <Text style={[
                      styles.accountTypeCardText,
                      selectedAccountType === type.value && styles.accountTypeCardTextActive
                    ]}>
                      {type.label}
                    </Text>
                    {selectedAccountType === type.value && (
                      <View style={styles.accountTypeCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color="#C9A24D" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Email and Password - Only visible after account type is selected */}
            {selectedAccountType && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    textContentType="oneTimeCode"
                    autoComplete="off"
                  />
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={() => router.push('/(auth)/forgot-password')}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Contact admin for account access
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1E2E',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 140,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextGold: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#C9A24D',
  },
  logoTextWhite: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#C9A24D',
  },
  logoSubtext: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#C9A24D',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  button: {
    height: 48,
    backgroundColor: '#C9A24D',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#C9A24D',
    fontSize: 14,
    fontWeight: '500',
  },
  accountTypeCards: {
    flexDirection: 'row',
    gap: 12,
  },
  accountTypeCard: {
    flex: 1,
    backgroundColor: '#1A2A3A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  accountTypeCardActive: {
    borderColor: '#C9A24D',
    backgroundColor: 'rgba(201, 162, 77, 0.1)',
  },
  accountTypeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  accountTypeIconContainerActive: {
    backgroundColor: 'rgba(201, 162, 77, 0.2)',
  },
  accountTypeCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  accountTypeCardTextActive: {
    color: '#FFFFFF',
  },
  accountTypeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

