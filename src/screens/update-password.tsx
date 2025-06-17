import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { token_hash, type } = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (type === 'recovery') {
    }
  }, [type]);

  const handleUpdatePassword = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      Alert.alert('Success', 'Password updated successfully!');
      router.replace('/auth/login');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Update Password</Text>
        
        <Text style={styles.label}>New Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new password"
          placeholderTextColor="#666"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#666"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          <LinearGradient
            colors={['#FF5864', '#FF8E53']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Updating...' : 'Update Password'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 40,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    color: '#fff',
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    backgroundColor: '#222',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
    color: 'white',
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'Inter_400Regular',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    color: '#FF5864',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    color: '#aaa',
    fontFamily: 'Inter_400Regular',
  },
  footerLink: {
    color: '#FF5864',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
