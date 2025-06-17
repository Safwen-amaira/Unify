import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

export default function SplashScreen({ onComplete, shouldNavigate, initialRoute }) {
  useEffect(() => { 
    const timer = setTimeout(() => {
      onComplete(); // Notify parent component that splash is done
    }, 5000); 

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/SplashScreenAnimation.json')}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text style={styles.appName}>Unify</Text>
      <Text style={styles.slogan}>Date casually, make friends, Hook up & more...</Text>
      <Text style={styles.poweredby}>Powered By Serliny</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  animation: {
    width: 200,
    height: 200,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
  },
  poweredby: {
    position: 'absolute',
    bottom: "10%",
    color: "gray",
  },
  slogan: {
    fontSize: 16, 
    color: "white",
    marginTop: 15,
    opacity: 0.8,
  },
});