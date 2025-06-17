import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useNavigation } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase'; 

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const validateName = (text: string) => {
    const nameRegex = /^[a-zA-Z\s]*$/;
    if (!nameRegex.test(text)) {
      setErrors(prev => ({ ...prev, name: 'Only alphabets and spaces allowed' }));
    } else {
      setErrors(prev => ({ ...prev, name: '' }));
    }
    setName(text);
  };

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
    }
    setEmail(text);
  };

  const validatePassword = (text: string) => {
    if (text.length < 8) {
      setErrors(prev => ({ ...prev, password: 'Password must be at least 8 characters' }));
    } else {
      setErrors(prev => ({ ...prev, password: '' }));
    }
    setPassword(text);
  };

  const validateConfirmPassword = (text: string) => {
    if (text !== password) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
    setConfirmPassword(text);
  };

  const handleSignup = async () => {
    validateName(name);
    validateEmail(email);
    validatePassword(password);
    validateConfirmPassword(confirmPassword);

    if (
      errors.name || errors.email || errors.password || errors.confirmPassword ||
      !name || !email || !password || !confirmPassword
    ) {
      Alert.alert('Error', 'Please fix all errors before submitting');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error || !data.user) {
        let errorMessage = error?.message || 'Signup failed. Please try again.';
        if (error?.message.includes('already registered')) {
          errorMessage = 'Email already in use';
        }
        Alert.alert('Error', errorMessage);
        return;
      }

      // Insert into 'profiles' table
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: name,
      });

      if (profileError) {
        Alert.alert('Error', 'Failed to create user profile');
        return;
      }


      navigation.navigate("Login")
    } catch (err) {
      Alert.alert('Error', 'Unexpected error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <Animated.View entering={FadeInUp.duration(1000).springify()} style={styles.logoContainer} />

        <Animated.Text entering={FadeInDown.duration(800).springify()} style={styles.title}>
          Create Account
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(100).duration(800).springify()} style={styles.subtitle}>
          Join our community today
        </Animated.Text>

        <View style={styles.form}>
          {/* Name */}
          <Animated.View entering={FadeInDown.delay(200).duration(800).springify()}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={[styles.inputContainer, errors.name ? styles.inputError : null]}>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={validateName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </Animated.View>

          {/* Email */}
          <Animated.View entering={FadeInDown.delay(250).duration(800).springify()}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </Animated.View>

          {/* Password */}
          <Animated.View entering={FadeInDown.delay(300).duration(800).springify()}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Create a password (min 8 chars)"
                placeholderTextColor="#666"
                value={password}
                onChangeText={validatePassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </Animated.View>

          {/* Confirm Password */}
          <Animated.View entering={FadeInDown.delay(350).duration(800).springify()}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
              <TextInput
                ref={confirmPasswordRef}
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={validateConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={24} color="#666" />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </Animated.View>

          {/* Sign Up Button */}
          <Animated.View entering={FadeInDown.delay(400).duration(800).springify()}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSignup}
              disabled={loading}
            >
              <LinearGradient colors={['#FF5864', '#FF8E53']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Terms and Footer */}
          <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(700).duration(800)} style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
<Pressable onPress={() => navigation.navigate('Auth')}>
  <Text style={styles.footerLink}>Sign in</Text>
</Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // same as your existing styles
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 30 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '700', color: 'white', marginBottom: 8, textAlign: 'center', fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 16, color: '#aaa', marginBottom: 40, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  form: { width: '100%' },
  inputLabel: { color: '#fff', marginBottom: 8, fontSize: 14, fontFamily: 'Inter_500Medium' },
  inputContainer: { backgroundColor: '#222', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#333', flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, padding: 18, fontSize: 16, color: 'white', fontFamily: 'Inter_400Regular' },
  inputError: { borderColor: '#FF5864' },
  errorText: { color: '#FF5864', fontSize: 12, marginBottom: 12, fontFamily: 'Inter_400Regular' },
  eyeIcon: { padding: 16 },
  button: { borderRadius: 12, overflow: 'hidden', marginTop: 10, shadowColor: '#FF5864', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.7 },
  gradient: { padding: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  termsContainer: { marginTop: 24, paddingHorizontal: 10 },
  termsText: { color: '#aaa', textAlign: 'center', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  termsLink: { color: '#FF5864', fontFamily: 'Inter_500Medium' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#aaa', fontFamily: 'Inter_400Regular' },
  footerLink: { color: '#FF5864', fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
