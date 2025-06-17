import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const { setUser } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Log Out", 
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              setUser(null);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          } 
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(800).springify()} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </Animated.View>

        {/* Profile Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(800).springify()}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="person" size={20} color="#FF5864" />
            </View>
            <Text style={styles.settingText}>Edit Profile</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="lock-closed" size={20} color="#FF5864" />
            </View>
            <Text style={styles.settingText}>Privacy Settings</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color="#666" />
          </TouchableOpacity>
        </Animated.View>

        {/* Preferences Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(800).springify()}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="notifications" size={20} color="#FF5864" />
            </View>
            <Text style={styles.settingText}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#767577", true: "#FF5864" }}
              thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
            />
          </View>
        </Animated.View>

        {/* Support Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(800).springify()}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="help-circle" size={20} color="#FF5864" />
            </View>
            <Text style={styles.settingText}>Help Center</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="document-text" size={20} color="#FF5864" />
            </View>
            <Text style={styles.settingText}>Terms & Conditions</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color="#666" />
          </TouchableOpacity>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeInDown.delay(400).duration(800).springify()}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <LinearGradient 
              colors={['#FF5864', '#FF8E53']} 
              style={styles.logoutGradient}
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.logoutText}>Log Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  section: {
    backgroundColor: 'transparent',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    paddingVertical: 8,
    paddingHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Inter_500Medium',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#222',
    marginBottom: 1,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 88, 100, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
  },
  logoutButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoutGradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});

export default SettingsScreen;