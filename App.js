import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import MainNavigator from './src/navigation/MainNavigator';
import SplashScreen from './src/screens/SplashScreen';
import { AuthProvider } from './src/context/AuthContext';
import 'expo-linear-gradient';

export default function App() {
  const [appState, setAppState] = useState({
    isLoading: true,
    hasViewedOnboarding: false,
    session: null,
    showSplash: true
  });

  useEffect(() => {
    const prepareApp = async () => {
      try {
        // Check onboarding status
        const onboardingValue = await AsyncStorage.getItem('@viewedOnboarding');
        
        // Check auth session
        const { data: { session } } = await supabase.auth.getSession();

        setAppState(prev => ({
          ...prev,
          hasViewedOnboarding: onboardingValue !== null,
          session,
          isLoading: false
        }));

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setAppState(prev => ({ ...prev, session }));
        });

        return () => subscription?.unsubscribe();
      } catch (error) {
        console.error('App initialization error:', error);
        setAppState(prev => ({ ...prev, isLoading: false }));
      }
    };

    prepareApp();
  }, []);

  const handleSplashComplete = () => {
    setAppState(prev => ({ ...prev, showSplash: false }));
  };

  if (appState.showSplash) {
    return (
      <SplashScreen 
        onComplete={handleSplashComplete}
        shouldNavigate={!appState.isLoading}
        initialRoute={
          !appState.hasViewedOnboarding ? 'Onboarding' : 
          appState.session ? 'Home' : 'Auth'
        }
      />
    );
  }

  return (
    <NavigationContainer>
      <AuthProvider>
        <MainNavigator 
          initialRoute={
            !appState.hasViewedOnboarding ? 'Onboarding' : 
            appState.session ? 'MatchScreen' : 'Home'
          } 
        />
      </AuthProvider>
    </NavigationContainer>
  );
}