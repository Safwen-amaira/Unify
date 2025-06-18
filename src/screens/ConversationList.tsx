import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  RefreshControl,
  TextInput,
  Platform,
  Keyboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useDebounce } from 'use-debounce';
import * as Haptics from 'expo-haptics';
import BottomNavbar from './BottomNavbar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_IMAGE = require('../../assets/placeholder.jpg');

const ConversationList = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const searchSlideAnim = useRef(new Animated.Value(30)).current;
  const searchOpacityAnim = useRef(new Animated.Value(0)).current;
  const itemAnimations = useRef([]);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    const sub = setupRealtimeUpdates();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(headerSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(searchSlideAnim, {
        toValue: 0,
        friction: 7,
        tension: 30,
        useNativeDriver: true,
        delay: 150,
      }),
      Animated.timing(searchOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        delay: 150,
      }),
    ]).start();

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [user]);

  useEffect(() => {
    if (debouncedSearch.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv =>
        conv.otherUser?.full_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
      setFilteredConversations(filtered);
    }
  }, [debouncedSearch, conversations]);

  const fetchConversations = async () => {
    if (!user) return;

    setLoading(true);
    try {
  const { data, error } = await supabase
  .from('conversations')
  .select(`
    id,
    user1_id,
    user2_id,
    last_message_at,
    last_message_text,
    messages(
      id,
      is_read,
      sender_id
    ),
    other_user:profiles!conversations_user2_id_fkey(
      id,
      full_name,
      profile_image,
      is_online,
      badges:badges!profile_id(label, icon_url, background_color)
    )
  `)
  .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
  .order('last_message_at', { ascending: false });
      if (error) throw error;

      const processed = data.map((conv) => {
        const otherUser = conv.user1_id === user.id ? conv.other_user : conv.other_user;
        const unreadCount = conv.messages?.filter(
          (msg) => !msg.is_read && msg.sender_id !== user.id
        ).length || 0;

        return {
          ...conv,
          otherUser,
          lastMessage: formatLastMessage(conv.last_message_text),
          lastMessageTime: conv.last_message_at,
          unreadCount,
          isNew: Date.now() - new Date(conv.last_message_at).getTime() < 60000,
        };
      });

      setConversations(processed);
      setFilteredConversations(processed);
      itemAnimations.current = processed.map(() => new Animated.Value(0));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatLastMessage = (text) => {
    if (!text) return 'No messages yet';
    if (text.startsWith('🖼️')) return 'Photo';
    if (text.startsWith('📍')) return 'Location';
    if (text.length > 30) return `${text.substring(0, 30)}...`;
    return text;
  };

  const setupRealtimeUpdates = () => {
    if (!user) return null;

    return supabase
      .channel('conversation-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(user1_id.eq.${user.id},user2_id.eq.${user.id})`,
        },
        () => fetchConversations()
      )
      .subscribe();
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleConversationPress = useCallback((item) => {
    Haptics.selectionAsync();
    navigation.navigate('Chat', {
      conversationId: item.id,
      otherUser: item.otherUser,
    });
  }, [navigation]);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, []);

  const renderItem = ({ item, index }) => {
    const scaleAnim = itemAnimations.current[index] || new Animated.Value(0.9);
    const opacityAnim = itemAnimations.current[index] || new Animated.Value(0);

    Animated.sequence([
      Animated.delay(index * 60),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return (
      <Animated.View 
        style={{ 
          opacity: opacityAnim, 
          transform: [{ scale: scaleAnim }],
          paddingHorizontal: 8,
        }}
      >
        <TouchableOpacity
          style={[
            styles.conversationItem,
            item.unreadCount > 0 && styles.unreadConversation,
            item.isNew && styles.newConversation,
          ]}
          onPress={() => handleConversationPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={item.otherUser?.profile_image ? { uri: item.otherUser.profile_image } : DEFAULT_IMAGE}
              style={styles.avatar}
            />
            {item.otherUser?.is_online && <View style={styles.onlineIndicator} />}

            {item.otherUser?.badges?.length > 0 && (
              <View style={styles.badgePreview}>
                {item.otherUser.badges.slice(0, 2).map((badge, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.miniBadge, 
                      { backgroundColor: badge.background_color || '#FF5864' }
                    ]}
                  >
                    {badge.icon_url ? (
                      <Image source={{ uri: badge.icon_url }} style={styles.miniBadgeIcon} />
                    ) : (
                      <Ionicons name="ribbon" size={10} color="white" />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.conversationInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.otherUser?.full_name}
              </Text>
              <Text style={styles.time}>
                {item.lastMessageTime
                  ? new Date(item.lastMessageTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </Text>
            </View>
            <View style={styles.messageRow}>
              <Text
                style={[
                  styles.lastMessage, 
                  item.unreadCount > 0 && styles.unreadMessage,
                  item.isNew && styles.newMessage
                ]}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={item.unreadCount > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'} 
            style={styles.chevron} 
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient 
        colors={['#1a1a1a', '#121212']} 
        style={styles.loadingContainer}
      >
        <LottieView 
          source={require('../../assets/animations/loading.json')} 
          autoPlay 
          loop 
          style={styles.loadingAnimation} 
        />
        <Text style={styles.loadingText}>Loading your conversations...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient 
      colors={['#1a1a1a', '#121212']} 
      style={styles.container}
    >
      <Animated.View 
        style={[
          styles.header, 
          { transform: [{ translateY: headerSlideAnim }] }
        ]}
      >
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{conversations.length}</Text>
        </View>
      </Animated.View>

      <Animated.View 
        style={[
          styles.searchContainer,
          { 
            transform: [{ translateY: searchSlideAnim }],
            opacity: searchOpacityAnim,
          }
        ]}
      >
        <View style={styles.searchInputContainer}>
          <Ionicons 
            name="search" 
            size={20} 
            color={isSearchFocused ? '#FF5864' : 'rgba(255,255,255,0.5)'} 
            style={styles.searchIcon} 
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setIsSearchFocused(true);
              scrollToTop();
            }}
            onBlur={() => setIsSearchFocused(false)}
            clearButtonMode="while-editing"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                setSearchQuery('');
                Keyboard.dismiss();
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <FlatList
          ref={flatListRef}
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="#FF5864"
              colors={['#FF5864']}
              progressBackgroundColor="#2A2A2A"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <LottieView 
                source={require('../../assets/animations/empty-conversation.json')} 
                autoPlay 
                loop 
                style={styles.emptyAnimation} 
              />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Start a new conversation with your matches!'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity 
                  style={styles.discoverButton} 
                  onPress={() => navigation.navigate('MatchScreen')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discoverButtonText}>Discover People</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      </Animated.View>
  
      <BottomNavbar
        items={[
          {
            name: 'Discover',
            icon: 'home',
            isActive: false,
            onPress: () => navigation.navigate('MatchScreen'),
          },
          {
            name: 'Messages',
            icon: 'chatbubbles',
            isActive: true,
            onPress: () => navigation.navigate('Conversations'),
          },
          {
            name: 'Matches',
            icon: 'heart',
            isActive: false,
            onPress: () => navigation.navigate('Matches'),
          },
          {
            name: 'Settings',
            icon: 'settings',
            isActive: false,
            onPress: () => navigation.navigate('Settings'),
          },
        ]}
      />
      
          </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
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
    fontFamily: 'HelveticaNowDisplay-Medium',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-Bold',
    letterSpacing: -0.5,
  },
  headerBadge: {
    backgroundColor: '#FF5864',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontFamily: 'HelveticaNowDisplay-Regular',
    paddingVertical: 12,
    paddingRight: 10,
  },
  clearButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(42, 42, 42, 0.6)',
  },
  unreadConversation: {
    backgroundColor: 'rgba(42, 42, 42, 0.9)',
  },
  newConversation: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF5864',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255, 88, 100, 0.3)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  badgePreview: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  miniBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  miniBadgeIcon: {
    width: 10,
    height: 10,
  },
  conversationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-Medium',
    flex: 1,
    marginRight: 10,
  },
  time: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'HelveticaNowDisplay-Regular',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNowDisplay-Regular',
    flex: 1,
    marginRight: 10,
  },
  unreadMessage: {
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-Medium',
  },
  newMessage: {
    color: '#FF5864',
    fontFamily: 'HelveticaNowDisplay-Medium',
  },
  unreadBadge: {
    backgroundColor: '#FF5864',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  chevron: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: -50,
  },
  emptyAnimation: {
    width: 200,
    height: 200,
  },
  emptyText: {
    fontSize: 20,
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-Bold',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'HelveticaNowDisplay-Regular',
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 25,
    maxWidth: '80%',
  },
  discoverButton: {
    backgroundColor: '#FF5864',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 30,
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  discoverButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
});

export default ConversationList;