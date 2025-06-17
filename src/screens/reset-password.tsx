import { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform, 
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useNavigation } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const emailRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'myapp://reset-password', // Replace with your deep link URL
      });

      if (error) {
        throw error;
      }

      setMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.logoContainer} />

        <Animated.Text entering={FadeInDown.duration(800).springify()} style={styles.title}>
          Reset Password
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(100).duration(800).springify()}
          style={styles.subtitle}
        >
          Enter your email to receive a password reset link
        </Animated.Text>

        <View style={styles.form}>
          <Animated.View entering={FadeInDown.delay(200).duration(800).springify()}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleResetPassword}
            />
          </Animated.View>

          {message ? (
            <Animated.Text 
              entering={FadeInDown.delay(300).duration(800).springify()}
              style={styles.successText}
            >
              {message}
            </Animated.Text>
          ) : null}

          <Animated.View entering={FadeInDown.delay(400).duration(800).springify()}>
            <Pressable
              style={({ pressed }) => [
                styles.button, 
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <LinearGradient
                colors={['#FF5864', '#FF8E53']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(800)} style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <Pressable onPress={() => navigation.goBack()}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
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
  successText: {
    color: '#4BB543',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter_500Medium',
  },
});