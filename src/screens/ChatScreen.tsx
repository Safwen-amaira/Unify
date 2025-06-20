import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Image,
  Animated,
  Dimensions,
  Keyboard,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons, FontAwesome, Entypo } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { decode } from 'base64-arraybuffer';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ChatScreen = () => {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [cancelingRecording, setCancelingRecording] = useState(false);
  const flatListRef = useRef();
  const menuAnimation = useRef(new Animated.Value(0)).current;
  const modalAnimation = useRef(new Animated.Value(0)).current;

  // Animations
  const inputTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const replyPanelHeight = useRef(new Animated.Value(0)).current;
  const recordingScale = useRef(new Animated.Value(1)).current;
  const cancelRecordingTranslateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchMessages();
    setupRealtimeUpdates();
    requestPermissions();
    checkPremiumStatus();
    
    // Header animation
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(headerTranslateY, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
    
    return () => {
      supabase.removeChannel(subscription);
      stopRecording();
    };
  }, [conversationId]);

  const checkPremiumStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('premium_subscribers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setIsPremium(true);
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
    }
  };

  const requestPermissions = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
      markMessagesAsRead();
      scrollToBottom(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  let subscription;
  const setupRealtimeUpdates = () => {
    subscription = supabase
      .channel(`messages:conversation_id=eq.${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new]);
            markMessagesAsRead();
            scrollToBottom();
            
            if (payload.new.sender_id !== user.id) {
              simulateTyping();
            }
          }
        }
      )
      .subscribe();
  };

  const simulateTyping = () => {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1500);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const pickMedia = async (type) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'video' && !isPremium) {
          Alert.alert('Premium Feature', 'Video messages are only available for premium users.');
          return;
        }
        
        setMediaPreview(result.assets[0].uri);
        setMediaType(type);
        
        if (type === 'video') {
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(
              result.assets[0].uri,
              { time: 1000 }
            );
            setMediaPreview(uri); // Show thumbnail for video
          } catch (e) {
            console.error('Error generating video thumbnail:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', `Failed to pick ${type}`);
    }
  };

  const uploadMedia = async (uri, type) => {
    setIsUploading(true);
    try {
      const fileExtension = uri.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExtension}`;
      
      const file = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data, error } = await supabase.storage
        .from('messages')
        .upload(fileName, decode(file), {
          contentType: type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'audio/mpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to upload media');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Cancel any existing recording
      if (recording) {
        await recording.stopAndUnloadAsync();
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await newRecording.startAsync();
      
      setRecording(newRecording);
      setIsRecording(true);
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingScale, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingScale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const cancelRecording = async () => {
    setCancelingRecording(true);
    try {
      Animated.timing(cancelRecordingTranslateX, {
        toValue: -SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(async () => {
        await stopRecording();
        setCancelingRecording(false);
        cancelRecordingTranslateX.setValue(0);
      });
    } catch (error) {
      console.error('Failed to cancel recording:', error);
      setCancelingRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      setIsRecording(false);
      recordingScale.stopAnimation();
      recordingScale.setValue(1);
      
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    } finally {
      setRecording(null);
    }
  };

  const sendVoiceMessage = async () => {
    try {
      const uri = await stopRecording();
      if (!uri) return;

      setIsUploading(true);
      
      const audioUrl = await uploadMedia(uri, 'audio');
      if (!audioUrl) return;

      const messageData = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: 'Voice message',
        media_url: audioUrl,
        media_type: 'audio',
        ...(replyTo && { reply_to: replyTo.id })
      };

      await sendSupabaseMessage(messageData);
      
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setIsUploading(false);
    }
  };

  const sendSupabaseMessage = async (messageData) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: messageData.media_type 
            ? `Sent a ${messageData.media_type}` 
            : messageData.content
        })
        .eq('id', conversationId);

      setNewMessage('');
      setMediaPreview(null);
      setMediaType(null);
      if (replyTo) {
        Animated.timing(replyPanelHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start(() => setReplyTo(null));
      }
      scrollToBottom();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaPreview) || !user) return;

    try {
      let messageData = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage,
        ...(replyTo && { reply_to: replyTo.id })
      };

      if (mediaPreview) {
        setIsUploading(true);
        const mediaUrl = await uploadMedia(mediaPreview, mediaType);
        if (mediaUrl) {
          messageData.media_url = mediaUrl;
          messageData.media_type = mediaType;
        }
      }

      await sendSupabaseMessage(messageData);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsUploading(false);
    }
  };

  const scrollToBottom = (animated = true) => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated });
      hideScrollButton();
    }
  };

  const handleScroll = ({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollButton(!isNearBottom);
  };

  const showScrollButtons = () => {
    Animated.timing(scrollButtonOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hideScrollButton = () => {
    Animated.timing(scrollButtonOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowScrollButton(false));
  };

  const handleReply = (message) => {
    setReplyTo(message);
    Animated.timing(replyPanelHeight, {
      toValue: 60,
      duration: 200,
      useNativeDriver: false,
    }).start();
    Keyboard.dismiss();
  };

  const cancelReply = () => {
    Animated.timing(replyPanelHeight, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setReplyTo(null));
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const toggleMenu = () => {
    if (showMenu) {
      Animated.timing(menuAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowMenu(false));
    } else {
      setShowMenu(true);
      Animated.timing(menuAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const toggleProfileModal = () => {
    if (showProfileModal) {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowProfileModal(false));
    } else {
      setShowProfileModal(true);
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBlockUser = async () => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert([{ user_id: user.id, blocked_user_id: otherUser.id }]);

      if (error) throw error;

      Alert.alert('Success', `${otherUser.full_name} has been blocked`);
      navigation.goBack();
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user');
    }
  };

  const handlePoke = () => {
    Alert.alert('Poke', `You poked ${otherUser.full_name}!`);
    toggleMenu();
  };

  const VoiceMessagePlayer = ({ uri, isCurrentUser }) => {
    const sound = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    
    const loadSound = async () => {
      try {
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
            if (status.isLoaded) {
              setDuration(status.durationMillis);
              setPosition(status.positionMillis);
              setIsPlaying(status.isPlaying);
            }
          }
        );
        sound.current = audioSound;
      } catch (error) {
        console.error('Error loading sound:', error);
      }
    };
    
    useEffect(() => {
      loadSound();
      return () => {
        if (sound.current) {
          sound.current.unloadAsync();
        }
      };
    }, [uri]);
    
    const togglePlayPause = async () => {
      try {
        if (!sound.current) return;
        
        if (isPlaying) {
          await sound.current.pauseAsync();
        } else {
          await sound.current.playAsync();
        }
      } catch (error) {
        console.error('Error toggling play/pause:', error);
      }
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.voiceMessageContainer,
          isCurrentUser ? styles.currentUserVoiceMessage : styles.otherUserVoiceMessage
        ]}
        onPress={togglePlayPause}
      >
        <View style={styles.voiceMessageWaveform}>
          {[...Array(20)].map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.voiceMessageBar,
                isCurrentUser ? styles.currentUserVoiceBar : styles.otherUserVoiceBar,
                { 
                  height: 4 + Math.random() * 16,
                  opacity: isPlaying ? 0.8 : 0.5 
                }
              ]} 
            />
          ))}
        </View>
        <View style={styles.voiceMessageControls}>
          <FontAwesome 
            name={isPlaying ? 'pause' : 'play'} 
            size={12} 
            color={isCurrentUser ? 'white' : '#FF5864'} 
          />
          <Text style={[
            styles.voiceMessageDuration,
            isCurrentUser ? styles.currentUserVoiceDuration : styles.otherUserVoiceDuration
          ]}>
            {Math.floor(duration / 1000)}s
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isCurrentUser = item.sender_id === user.id;
    const showAvatar = !isCurrentUser && 
      (index === 0 || messages[index - 1].sender_id !== item.sender_id);
    const showTime = index === messages.length - 1 || 
      messages[index + 1].sender_id !== item.sender_id ||
      new Date(messages[index + 1].created_at).getTime() - new Date(item.created_at).getTime() > 300000;
    
    return (
      <Pressable 
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage,
          { marginTop: showAvatar ? 12 : 4 }
        ]}
        onLongPress={() => handleReply(item)}
      >
        {showAvatar && (
          <Image
            source={otherUser.profile_image ? { uri: otherUser.profile_image } : require('../../assets/placeholder.jpg')}
            style={styles.messageAvatar}
          />
        )}
        
        <View style={{ maxWidth: '80%' }}>
          {item.reply_to && (
            <View style={[
              styles.replyPreview,
              isCurrentUser ? styles.currentUserReplyPreview : styles.otherUserReplyPreview
            ]}>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {messages.find(m => m.id === item.reply_to)?.content || 'Original message'}
              </Text>
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
            !showAvatar && isCurrentUser ? { marginLeft: 48 } : {},
            !showAvatar && !isCurrentUser ? { marginRight: 48 } : {},
          ]}>
            {item.media_type === 'image' ? (
              <Image 
                source={{ uri: item.media_url }} 
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : item.media_type === 'video' ? (
              <View style={styles.videoContainer}>
                <Image 
                  source={{ uri: item.media_url }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
                <View style={styles.videoPlayButton}>
                  <Ionicons name="play" size={30} color="white" />
                </View>
              </View>
            ) : item.media_type === 'audio' ? (
              <VoiceMessagePlayer 
                uri={item.media_url}
                isCurrentUser={isCurrentUser}
              />
            ) : null}
            
            {item.content && item.media_type !== 'audio' && (
              <Text style={[
                styles.messageText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText
              ]}>
                {item.content}
              </Text>
            )}
            
            {showTime && (
              <View style={styles.timeContainer}>
                {item.is_read && isCurrentUser && (
                  <Ionicons name="checkmark-done" size={14} color="#4CAF50" style={styles.readIcon} />
                )}
                <Text style={[
                  styles.messageTime,
                  isCurrentUser ? styles.currentUserTime : styles.otherUserTime
                ]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.loadingContainer}>
        <LottieView 
          source={require('../../assets/animations/loading.json')} 
          autoPlay 
          loop 
          style={styles.loadingAnimation}
        />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </LinearGradient>
    );
  }

  const menuTranslateY = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const menuOpacity = menuAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalTranslateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <Animated.View style={[
        styles.header,
        { 
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }]
        }
      ]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Pressable 
          style={styles.headerUserInfo}
          onPress={toggleProfileModal}
        >
          <Image
            source={otherUser.profile_image ? { uri: otherUser.profile_image } : require('../../assets/placeholder.jpg')}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerName}>{otherUser.full_name}</Text>
            {isTyping ? (
              <Text style={styles.headerStatus}>typing...</Text>
            ) : (
              <Text style={styles.headerStatus}>
                {otherUser.is_online ? 'online' : 'last seen recently'}
              </Text>
            )}
          </View>
        </Pressable>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={toggleMenu}
        >
          <Feather name="more-vertical" size={20} color="white" />
        </TouchableOpacity>

        {showMenu && (
          <Animated.View style={[
            styles.menuContainer,
            {
              opacity: menuOpacity,
              transform: [{ translateY: menuTranslateY }]
            }
          ]}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handlePoke}
            >
              <Feather name="bell" size={18} color="white" />
              <Text style={styles.menuItemText}>Poke</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleBlockUser}
            >
              <Ionicons name="ban" size={18} color="white" />
              <Text style={styles.menuItemText}>Block</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollToBottom(false)}
        onLayout={() => scrollToBottom(false)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LottieView 
              source={require('../../assets/animations/empty-conversation.json')} 
              autoPlay 
              loop 
              style={styles.emptyAnimation}
            />
            <Text style={styles.emptyText}>Start the conversation!</Text>
            <Text style={styles.emptySubtext}>Send your first message to {otherUser.full_name.split(' ')[0]}</Text>
          </View>
        }
      />

      <Animated.View style={[styles.replyPanel, { height: replyPanelHeight }]}>
        {replyTo && (
          <>
            <View style={styles.replyPanelContent}>
              <View style={styles.replyPanelLine} />
              <View style={styles.replyPanelTextContainer}>
                <Text style={styles.replyPanelTitle}>
                  {replyTo.sender_id === user.id ? 'You' : otherUser.full_name.split(' ')[0]}
                </Text>
                <Text style={styles.replyPanelMessage} numberOfLines={1}>
                  {replyTo.content}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.replyPanelCancel}>
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>

      {mediaPreview && (
        <View style={styles.mediaPreviewContainer}>
          <Image source={{ uri: mediaPreview }} style={styles.mediaPreviewImage} />
          <TouchableOpacity 
            style={styles.mediaPreviewCancel}
            onPress={() => {
              setMediaPreview(null);
              setMediaType(null);
            }}
          >
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        style={styles.inputWrapper}
      >
        <Animated.View style={[styles.inputContainer, { transform: [{ translateY: inputTranslateY }] }]}>
          <TouchableOpacity 
            style={styles.attachmentButton}
            onPress={() => {
              Alert.alert(
                'Choose Media',
                'Select the type of media you want to send',
                [
                  {
                    text: 'Photo',
                    onPress: () => pickMedia('image')
                  },
                  {
                    text: 'Video',
                    onPress: () => pickMedia('video')
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  }
                ]
              );
            }}
            disabled={isRecording || isUploading}
          >
            <Ionicons name="attach" size={24} color="#FF5864" />
          </TouchableOpacity>

          {isRecording && (
            <Animated.View 
              style={[
                styles.recordingContainer,
                { transform: [{ translateX: cancelRecordingTranslateX }] }
              ]}
            >
              <TouchableOpacity 
                style={styles.cancelRecordingButton}
                onPress={cancelRecording}
                disabled={cancelingRecording}
              >
                <Text style={styles.cancelRecordingText}>Cancel</Text>
              </TouchableOpacity>
              
              <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: recordingScale }] }]}>
                <MaterialIcons name="mic" size={24} color="white" />
              </Animated.View>
              
              <Text style={styles.recordingText}>Recording...</Text>
            </Animated.View>
          )}

          {!isRecording && (
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={`Message ${otherUser.full_name.split(' ')[0]}...`}
              placeholderTextColor="rgba(255,255,255,0.5)"
              multiline
              editable={!isUploading}
              onFocus={() => {
                Animated.timing(inputTranslateY, {
                  toValue: -10,
                  duration: 200,
                  useNativeDriver: true,
                }).start();
              }}
              onBlur={() => {
                Animated.timing(inputTranslateY, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start();
              }}
            />
          )}

          <TouchableOpacity
            style={[
              styles.sendButton,
              !newMessage.trim() && !mediaPreview && !isRecording ? styles.sendButtonDisabled : {},
              isUploading && styles.sendButtonUploading
            ]}
            onPress={isRecording ? sendVoiceMessage : (newMessage.trim() || mediaPreview ? sendMessage : startRecording)}
            onLongPress={startRecording}
            delayLongPress={300}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : isRecording ? (
              <Ionicons name="send" size={20} color="white" />
            ) : newMessage.trim() || mediaPreview ? (
              <Ionicons name="send" size={20} color="white" />
            ) : (
              <MaterialIcons name="mic" size={20} color="white" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>

      {showScrollButton && (
        <Animated.View style={[styles.scrollButton, { opacity: scrollButtonOpacity }]}>
          <TouchableOpacity onPress={() => scrollToBottom()} style={styles.scrollButtonInner}>
            <MaterialIcons name="arrow-downward" size={20} color="white" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <Modal
        visible={showProfileModal}
        transparent
        animationType="none"
        onRequestClose={toggleProfileModal}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={toggleProfileModal}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                opacity: modalOpacity,
                transform: [{ translateY: modalTranslateY }]
              }
            ]}
          >
            <Image
              source={otherUser.profile_image ? { uri: otherUser.profile_image } : require('../../assets/placeholder.jpg')}
              style={styles.profileImage}
            />
            <Text style={styles.profileName}>{otherUser.full_name}</Text>
            <Text style={styles.profileStatus}>
              {otherUser.is_online ? 'Online' : 'Offline'}
            </Text>
            
            <View style={styles.profileDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="time" size={20} color="#FF5864" />
                <Text style={styles.detailText}>Joined {new Date(otherUser.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="information-circle" size={20} color="#FF5864" />
                <Text style={styles.detailText}>{otherUser.bio || 'No bio yet'}</Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={toggleProfileModal}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
  },
  loadingAnimation: {
    width: 180,
    height: 180,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 20,
    fontFamily: 'Inter-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,88,100,0.2)',
    backgroundColor: 'rgba(13,13,13,0.95)',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(42,42,42,0.5)',
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,88,100,0.4)',
  },
  headerName: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(42,42,42,0.5)',
  },
  menuContainer: {
    position: 'absolute',
    right: 10,
    top: 65,
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    paddingVertical: 8,
    minWidth: 170,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,88,100,0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: 'white',
    fontSize: 15,
    marginLeft: 12,
    fontFamily: 'Inter-Medium',
  },
  messagesContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 90,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    opacity: 0.8,
  },
  emptyAnimation: {
    width: 220,
    height: 220,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.3,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,88,100,0.3)',
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 6,
  },
  currentUserBubble: {
    backgroundColor: '#FF5864',
    borderBottomRightRadius: 6,
  },
  otherUserBubble: {
    backgroundColor: '#252525',
    borderBottomLeftRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  currentUserText: {
    color: 'white',
  },
  otherUserText: {
    color: 'white',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  otherUserTime: {
    color: 'rgba(255,255,255,0.5)',
  },
  readIcon: {
    marginRight: 4,
  },
  replyPanel: {
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,88,100,0.2)',
  },
  replyPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  replyPanelLine: {
    width: 4,
    height: 36,
    backgroundColor: '#FF5864',
    borderRadius: 2,
    marginRight: 14,
  },
  replyPanelTextContainer: {
    flex: 1,
  },
  replyPanelTitle: {
    color: '#FF5864',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    fontFamily: 'Inter-SemiBold',
  },
  replyPanelMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  replyPanelCancel: {
    padding: 8,
    marginLeft: 10,
    backgroundColor: 'rgba(42,42,42,0.5)',
    borderRadius: 20,
  },
  replyPreview: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  currentUserReplyPreview: {
    backgroundColor: 'rgba(255,88,100,0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF5864',
  },
  otherUserReplyPreview: {
    backgroundColor: 'rgba(42,42,42,0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#252525',
  },
  replyPreviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontStyle: 'italic',
    fontFamily: 'Inter-Regular',
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18,18,18,0.95)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,88,100,0.2)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: 'rgba(42,42,42,0.7)',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#252525',
    color: 'white',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 120,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF5864',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#252525',
    shadowOpacity: 0,
  },
  sendButtonUploading: {
    backgroundColor: '#3A3A3A',
  },
  scrollButton: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    backgroundColor: 'rgba(37,37,37,0.95)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,88,100,0.2)',
  },
  scrollButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewContainer: {
    backgroundColor: '#252525',
    padding: 12,
    marginHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mediaPreviewImage: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  mediaPreviewCancel: {
    marginLeft: 12,
    padding: 6,
    backgroundColor: 'rgba(42,42,42,0.7)',
    borderRadius: 16,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  voiceMessageContainer: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
  },
  currentUserVoiceMessage: {
    backgroundColor: 'rgba(255, 88, 100, 0.15)',
    borderColor: 'rgba(255, 88, 100, 0.3)',
  },
  otherUserVoiceMessage: {
    backgroundColor: 'rgba(37, 37, 37, 0.7)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  voiceMessageWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginRight: 12,
  },
  voiceMessageBar: {
    width: 3,
    marginRight: 3,
    borderRadius: 2,
  },
  currentUserVoiceBar: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  otherUserVoiceBar: {
    backgroundColor: '#FF5864',
  },
  voiceMessageControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceMessageDuration: {
    marginLeft: 10,
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  currentUserVoiceDuration: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherUserVoiceDuration: {
    color: '#FF5864',
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,88,100,0.3)',
  },
  recordingIndicator: {
    backgroundColor: '#FF5864',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  recordingText: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
  },
  cancelRecordingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,88,100,0.2)',
    borderRadius: 14,
    marginRight: 10,
  },
  cancelRecordingText: {
    color: '#FF5864',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,88,100,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF5864',
    marginBottom: 16,
  },
  profileName: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  profileStatus: {
    color: '#FF5864',
    fontSize: 14,
    marginBottom: 20,
    fontFamily: 'Inter-Medium',
  },
  profileDetails: {
    width: '100%',
    marginTop: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginLeft: 10,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  closeModalButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    backgroundColor: 'rgba(42,42,42,0.7)',
    borderRadius: 20,
  },
  videoContainer: {
    position: 'relative',
  },
  videoPlayButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
});

export default ChatScreen;