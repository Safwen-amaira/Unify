import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from '../screens/onboarding';
import HomeScreen from '../screens/home';
import LoginScreen from '../screens/login';
import SignupScreen from '../screens/signup';
import { NavigationContainer } from '@react-navigation/native';
import UserDetailsScreen from '../screens/user-details';
import ResetPasswordScreen from '../screens/reset-password';
import MatchScreen from '../screens/MatchScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();

export default function MainNavigator({ initialRoute = 'Onboarding' }) {
  return (
    <Stack.Navigator 
      initialRouteName={initialRoute}
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: false
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Auth" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="DetailsCompletionAfterSignUp" component={UserDetailsScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="MatchScreen" component={MatchScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
     <Stack.Screen name="Settings" component={SettingsScreen} />

    </Stack.Navigator>
  );
}