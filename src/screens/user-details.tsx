import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Font from 'expo-font';

export default function UserDetailsScreen({ route }) {
  const { userId } = route.params;
  const [birthday, setBirthday] = useState('2000');
  const [drinks, setDrinks] = useState('never');
  const [smokes, setSmokes] = useState('never');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      Inter_500Medium: require('../../assets/fonts/Inter-Medium.ttf'),
      Inter_600SemiBold: require('../../assets/fonts/Inter-SemiBold.ttf'),
      Inter_700Bold: require('../../assets/fonts/Inter-Regular.ttf'),
    }).then(() => setFontsLoaded(true));
  }, []);

const handleSubmit = async () => {
  try {
    setLoading(true);
    
    // First validate the user ID exists
    if (!userId || typeof userId !== 'string') {
      Alert.alert('Error', 'Invalid user ID');
      return;
    }

    // Create the update data object
    const updateData = {
      birthday: `${birthday}-01-01`,
      drinking_informations: drinks,
      smoking_informations: smokes,
      updated_at: new Date().toISOString()  // Add update timestamp
    };

    console.log('Updating profile with:', updateData);  // Debug log

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();  // Add .select() to get the updated record

    console.log('Update response:', { data, error });  // Debug log

    if (error) {
      console.error('Supabase error details:', error);
      Alert.alert(
        'Update Failed', 
        error.message || 'Failed to update your profile. Please try again.'
      );
      return;
    }

    if (!data) {
      Alert.alert('Error', 'No data returned from update');
      return;
    }

    console.log('Successfully updated profile:', data);
    navigation.navigate('CompleteProfile', { userId });
    
  } catch (err) {
    console.error('Update error:', err);
    Alert.alert(
      'Error', 
      err.message || 'Something went wrong. Please try again.'
    );
  } finally {
    setLoading(false);
  }
};

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#FF5864" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Let's Personalize Your Experience</Text>

        {/* Birthday */}
        <View style={styles.section}>
          <Text style={styles.label}>Your Birth Year</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={birthday}
              onValueChange={(value) => setBirthday(value)}
              style={[styles.picker, Platform.OS === 'android' && styles.androidPicker]}
              dropdownIconColor="#fff"
              mode="dropdown"
              itemStyle={styles.pickerItem}
              numberOfLines={1}
            >
              {Array.from({ length: 83 }, (_, i) => 2024 - i).map((year) => (
                <Picker.Item key={year} label={`${year}`} value={`${year}`} color="#fff" />
              ))}
            </Picker>
          </View>
        </View>

        {/* Drinking */}
        <View style={styles.section}>
          <Text style={styles.label}>How often do you drink?</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={drinks}
              onValueChange={(value) => setDrinks(value)}
              style={[styles.picker, Platform.OS === 'android' && styles.androidPicker]}
              dropdownIconColor="#fff"
              mode="dropdown"
              itemStyle={styles.pickerItem}
              numberOfLines={1}
            >
              <Picker.Item label="Never" value="never" color="#fff" />
              <Picker.Item label="Occasionally" value="occasionally" color="#fff" />
              <Picker.Item label="Socially" value="socially" color="#fff" />
              <Picker.Item label="Regularly" value="regularly" color="#fff" />
            </Picker>
          </View>
        </View>

        {/* Smoking */}
        <View style={styles.section}>
          <Text style={styles.label}>How often do you smoke?</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={smokes}
              onValueChange={(value) => setSmokes(value)}
              style={[styles.picker, Platform.OS === 'android' && styles.androidPicker]}
              dropdownIconColor="#fff"
              mode="dropdown"
              itemStyle={styles.pickerItem}
              numberOfLines={1}
            >
              <Picker.Item label="Never" value="never" color="#fff" />
              <Picker.Item label="Occasionally" value="occasionally" color="#fff" />
              <Picker.Item label="Socially" value="socially" color="#fff" />
              <Picker.Item label="Regularly" value="regularly" color="#fff" />
            </Picker>
          </View>
        </View>

        {/* Submit Button */}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={['#FF5864', '#FF8E53']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Saving...' : 'Continue'}
            </Text>
            <MaterialIcons name="arrow-forward" size={24} color="white" />
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 30,
    paddingTop: 60,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 40,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  section: {
    marginBottom: 30,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    fontFamily: 'Inter_500Medium',
  },
  pickerContainer: {
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  picker: {
    height: 155, // bigger height
    fontSize: 16,
    width:240,
    alignContent:"center",
    alignSelf:'center',
    paddingHorizontal: 10,
    color: 'white',
  },
  androidPicker: {
    color: 'white',
  },
  pickerItem: {
    color: 'white',
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    padding: 18,
    flexDirection: 'row',
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
    marginRight: 10,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});
