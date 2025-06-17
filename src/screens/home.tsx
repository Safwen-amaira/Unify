import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  const navigation = useNavigation();

  const navigateToLogin = () => {
    navigation.navigate('Auth');
  };

  const navigateToSignup = () => {
    navigation.navigate('Signup');
  };

  return (
    <LinearGradient
      colors={['#1a1a1a', '#121212']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Unify</Text>
        <Text style={styles.subtitle}>Connect, share, and grow together</Text>
        
        <View style={styles.buttonContainer}>
          <Pressable 
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              pressed && styles.buttonPressed
            ]}
            onPress={navigateToLogin}
          >
            <Text style={styles.buttonText}>Login</Text>
          </Pressable>
          
          <Pressable 
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              pressed && styles.buttonPressed
            ]}
            onPress={navigateToSignup}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign Up</Text>
          </Pressable>
        </View>
        
        <Text style={styles.footerText}>By continuing, you agree to our Terms and Privacy Policy</Text>
      </View>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.54)',
    marginBottom: 48,
    textAlign: 'center',
    maxWidth: '80%',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    backgroundColor: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: 'white',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 32,
    textAlign: 'center',
  },
});