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
  ActivityIndicator
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, Feather, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { decode } from 'base64-arraybuffer';

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
  const flatListRef = useRef();
  const [RecordButtonState,setButtonRecord] = useState ('');
  // Animations
  const inputTranslateY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const replyPanelHeight = useRef(new Animated.Value(0)).current;
  const recordingScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchMessages();
    setupRealtimeUpdates();
    requestPermissions();
    
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

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setMediaPreview(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
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
          contentType: type === 'image' ? 'image/jpeg' : 'audio/mpeg',
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
    setButtonRecord("hidden");
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
    );
    await recording.startAsync();
    
    setRecording(recording);
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

const stopRecording = async () => {
  setButtonRecord('');
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
    const status = await recording.getStatusAsync();
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
        const imageUrl = await uploadMedia(mediaPreview, 'image');
        if (imageUrl) {
          messageData.media_url = imageUrl;
          messageData.media_type = 'image';
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
        
        <View style={styles.headerUserInfo}>
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
        </View>
        
        <TouchableOpacity style={styles.headerButton}>
          <Feather name="more-vertical" size={20} color="white" />
        </TouchableOpacity>
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
            onPress={() => setMediaPreview(null)}
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
            onPress={pickImage}
            disabled={isRecording || isUploading}
          >
            <Ionicons name="attach" size={24} color="#FF5864" />
          </TouchableOpacity>
          
          {isRecording ? (
            <TouchableOpacity 
              style={styles.recordingContainer}
              onPress={sendVoiceMessage}
            >
              <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: recordingScale }] }]}>
                <MaterialIcons name="mic" size={24} color="white" />
              </Animated.View>
              <Text style={styles.recordingText}>Recording... Tap to send</Text>
            </TouchableOpacity>
          ) : (
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
            onPress={newMessage.trim() || mediaPreview ? sendMessage : startRecording}
            onLongPress={startRecording}
            delayLongPress={300}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="white" />
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(26,26,26,0.9)',
  },
  backButton: {
    padding: 5,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,88,100,0.3)',
  },
  headerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  headerButton: {
    padding: 5,
    marginLeft: 10,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyAnimation: {
    width: 200,
    height: 200,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 4,
  },
  currentUserBubble: {
    backgroundColor: '#FF5864',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
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
  },
  currentUserTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherUserTime: {
    color: 'rgba(255,255,255,0.5)',
  },
  readIcon: {
    marginRight: 4,
  },
  replyPanel: {
    overflow: 'hidden',
    backgroundColor: 'rgba(42,42,42,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  replyPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  replyPanelLine: {
    width: 3,
    height: 40,
    backgroundColor: '#FF5864',
    borderRadius: 2,
    marginRight: 12,
  },
  replyPanelTextContainer: {
    flex: 1,
  },
  replyPanelTitle: {
    color: '#FF5864',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPanelMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  replyPanelCancel: {
    padding: 8,
    marginLeft: 10,
  },
  replyPreview: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  currentUserReplyPreview: {
    backgroundColor: 'rgba(255,88,100,0.2)',
    borderLeftWidth: 2,
    borderLeftColor: '#FF5864',
  },
  otherUserReplyPreview: {
    backgroundColor: 'rgba(42,42,42,0.5)',
    borderLeftWidth: 2,
    borderLeftColor: '#2A2A2A',
  },
  replyPreviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30,30,30,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Platform.OS === 'ios' ? 30 : 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachmentButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 16,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF5864',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  sendButtonUploading: {
    backgroundColor: '#666',
  },
  scrollButton: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    backgroundColor: 'rgba(42,42,42,0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewContainer: {
    backgroundColor: '#2A2A2A',
    padding: 10,
    marginHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  mediaPreviewCancel: {
    marginLeft: 10,
    padding: 5,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  voiceMessageContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentUserVoiceMessage: {
    backgroundColor: 'rgba(255, 88, 100, 0.2)',
  },
  otherUserVoiceMessage: {
    backgroundColor: 'rgba(42, 42, 42, 0.5)',
  },
  voiceMessageWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    marginRight: 10,
  },
  voiceMessageBar: {
    width: 2,
    marginRight: 2,
    borderRadius: 1,
  },
  currentUserVoiceBar: {
    backgroundColor: 'white',
  },
  otherUserVoiceBar: {
    backgroundColor: '#FF5864',
  },
  voiceMessageControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceMessageDuration: {
    marginLeft: 8,
    fontSize: 12,
  },
  currentUserVoiceDuration: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserVoiceDuration: {
    color: '#FF5864',
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recordingIndicator: {
    backgroundColor: '#FF5864',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recordingText: {
    color: 'white',
    fontSize: 14,
  },
});

export default ChatScreen;