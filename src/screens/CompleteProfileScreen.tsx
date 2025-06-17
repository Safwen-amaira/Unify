import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Animated, { FadeInDown } from 'react-native-reanimated';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as Crypto from 'expo-crypto';

const MAX_ALBUM_IMAGES = 50;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (array) => {
      const bytes = Crypto.getRandomBytes(array.length);
      array.set(bytes);
      return array;
    }
  };
}

export default function CompleteProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const [bio, setBio] = useState('');
  const [relationship, setRelationship] = useState('Single');
  const [profileImage, setProfileImage] = useState(null);
  const [albumImages, setAlbumImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to complete your profile.');
      }
    })();
  }, []);

  const uploadImageToSupabase = async (uri, type) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || fileInfo.size === 0) throw new Error('File does not exist or is empty');
      if (fileInfo.size > MAX_FILE_SIZE) throw new Error('File exceeds 5MB limit');

      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const fileExt = match ? match[1].toLowerCase() : 'jpg';
      const mimeType = `image/${fileExt}`;
      const path = `${userId}/${type}/${uuidv4()}.${fileExt}`;

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) throw new Error('User session not found');
      const accessToken = sessionData.session.access_token;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: path,
        type: mimeType,
      });

      const uploadUrl = `https://bzmqlkfguejkzqcmoovh.supabase.co/storage/v1/object/profile-images/${path}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Upload failed');
      }

      return `https://bzmqlkfguejkzqcmoovh.supabase.co/storage/v1/object/public/profile-images/${path}`;
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload Error', err.message || 'Upload failed.');
      return null;
    }
  };

  const pickProfileImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;
      const uri = result.assets[0].uri;

      setUploading(true);
      const imageUrl = await uploadImageToSupabase(uri, 'profile');
      if (imageUrl) {
        setProfileImage(imageUrl);
      }
      setUploading(false);
    } catch (err) {
      console.error('Profile image error:', err);
      setUploading(false);
    }
  };

  const pickAlbumImages = async () => {
    try {
      if (albumImages.length >= MAX_ALBUM_IMAGES) {
        Alert.alert('Limit Reached', `You can upload up to ${MAX_ALBUM_IMAGES} photos.`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_ALBUM_IMAGES - albumImages.length,
        quality: 0.7,
      });

      if (result.canceled) return;

      setUploading(true);
      const newImages = [];
      const newUrls = [];

      for (const asset of result.assets) {
        const imageUrl = await uploadImageToSupabase(asset.uri, 'album');
        if (imageUrl) {
          newImages.push(asset.uri);
          newUrls.push(imageUrl);
        }
      }

      if (newUrls.length > 0) {
        await supabase.from('profile_album_images').insert(
          newUrls.map(url => ({
            profile_id: userId,
            image_url: url,
          }))
        );
      }

      setAlbumImages(prev => [...prev, ...newImages]);
      setUploading(false);
    } catch (err) {
      console.error('Album image error:', err);
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!bio || !relationship || !profileImage) {
      Alert.alert('Incomplete', 'Please complete all required fields.');
      return;
    }

    setLoading(true);

    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      if (!existingProfile) {
        const { error: insertError } = await supabase.from('profiles').insert({ id: userId });
        if (insertError) throw insertError;
      }

      const { error } = await supabase.from('profiles')
        .update({
          bio,
          relationship,
          profile_image: profileImage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      navigation.navigate('MatchScreen');
    } catch (err) {
      console.error('Submit error:', err);
      Alert.alert('Error', 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Add your details to get started</Text>
        </Animated.View>

        <Text style={styles.label}>Profile Picture*</Text>
        <TouchableOpacity onPress={pickProfileImage} style={styles.imageUploadContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person" size={40} color="#666" />
              {uploading && <ActivityIndicator style={styles.uploadIndicator} color="#FF5864" />}
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Bio*</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself..."
          placeholderTextColor="#666"
          style={styles.input}
          multiline
        />

        <Text style={styles.label}>Relationship Status*</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={relationship}
            onValueChange={(value) => setRelationship(value)}
            style={styles.picker}
            dropdownIconColor="#FF5864"
          >
            {[
              'Single',
              'In a relationship',
              'Engaged',
              'Married',
              "It's complicated",
              'Open relationship',
              'Divorced',
              'Widowed',
            ].map(status => (
              <Picker.Item key={status} label={status} value={status} color="white" />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Photo Album ({albumImages.length}/{MAX_ALBUM_IMAGES})</Text>
        <TouchableOpacity onPress={pickAlbumImages} style={styles.albumButton}>
          <MaterialIcons name="add-photo-alternate" size={24} color="#FF5864" />
          <Text style={styles.albumButtonText}>Add Photos</Text>
        </TouchableOpacity>

        <ScrollView horizontal style={styles.albumScroll}>
          {albumImages.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.albumImage} />
          ))}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        >
          <LinearGradient
            colors={['#FF5864', '#FF8E53']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Complete Profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { padding: 20, paddingTop: 50 },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  imageUploadContainer: {
    alignSelf: 'center',
    marginBottom: 25,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: '#FF5864',
  },
  profileImagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  uploadIndicator: {
    position: 'absolute',
  },
  pickerContainer: {
    backgroundColor: '#222',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'android' ? 50 : undefined,
    color: 'white',
    paddingHorizontal: 10,
  },
  albumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  albumButtonText: {
    color: '#FF5864',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  albumScroll: {
    marginBottom: 25,
  },
  albumImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 30,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
