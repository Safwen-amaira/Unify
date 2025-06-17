import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useNavigation } from 'expo-router';
import { useRef, useState } from 'react';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '../lib/supabase'; // ⬅️ Make sure this path is correct

export default function LoginScreen() {
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();
const handleLogin = async () => {
  try {
    // 1. Sign in with email/password
    const { error: authError, data: { user } } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      Alert.alert('Login Error', authError.message);
      return;
    }

    // 2. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('birthday')
      .eq('id', user.id)
      .single();

    if (profileError) {
      Alert.alert('Error', 'Failed to fetch user profile');
      return;
    }

    // 3. Redirect based on birthday
    if (!profile.birthday) {
      // Birthday is null, redirect to UserDetailsScreen
      navigation.navigate('DetailsCompletionAfterSignUp', { userId: user.id });
    } else {
      // Birthday exists, go to Home
      navigation.navigate('MatchScreen');
    }

  } catch (err) {
    Alert.alert('Error', 'An unexpected error occurred');
    console.error(err);
  }
};

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.logoContainer}></Animated.View>

        <Animated.Text entering={FadeInDown.duration(800).springify()} style={styles.title}>
          Welcome back
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(100).duration(800).springify()}
          style={styles.subtitle}
        >
          Please enter your details to sign in
        </Animated.Text>

        <View style={styles.form}>
          <Animated.View entering={FadeInDown.delay(200).duration(800).springify()}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              value={email}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(800).springify()}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              secureTextEntry
              returnKeyType="done"
              onChangeText={setPassword}
              value={password}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(800).springify()}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={handleLogin}
            >
              <LinearGradient
                colors={['#FF5864', '#FF8E53']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Sign In</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(800).springify()}>
            <Pressable style={styles.forgotPassword}   onPress={() => navigation.navigate('ResetPassword') }>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
           <Pressable onPress={() => navigation.navigate('Signup')}>
  <Text style={styles.footerLink}>Sign up</Text>
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
