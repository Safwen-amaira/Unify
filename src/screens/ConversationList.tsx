import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_IMAGE = require('../../assets/placeholder.jpg');

const ConversationList = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const itemAnimations = useRef([]);

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
    ]).start();

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [user]);

  useEffect(() => {
    handleSearch(search);
  }, [conversations, search]);

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
          lastMessage: conv.last_message_text,
          lastMessageTime: conv.last_message_at,
          unreadCount,
        };
      });

      setConversations(processed);
      itemAnimations.current = processed.map(() => new Animated.Value(0));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealtimeUpdates = () => {
    if (!user) return null;

    const subscription = supabase
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

    return subscription;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (text.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const lowercased = text.toLowerCase();
      const filtered = conversations.filter((item) =>
        item.otherUser?.full_name?.toLowerCase().includes(lowercased)
      );
      setFilteredConversations(filtered);
    }
  };

  const renderItem = ({ item, index }) => {
    const scaleAnim = itemAnimations.current[index] || new Animated.Value(0.8);
    const opacityAnim = itemAnimations.current[index] || new Animated.Value(0);

    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return (
      <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.conversationItem}
          onPress={() =>
            navigation.navigate('Chat', {
              conversationId: item.id,
              otherUser: item.otherUser,
            })
          }
        >
          <View style={styles.avatarContainer}>
            <Image
              source={
                item.otherUser?.profile_image
                  ? { uri: item.otherUser.profile_image }
                  : DEFAULT_IMAGE
              }
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
                      { backgroundColor: badge.background_color || '#FF5864' },
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
                ]}
                numberOfLines={1}
              >
                {item.lastMessage || 'No messages yet'}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="rgba(255,255,255,0.3)"
            style={styles.chevron}
          />
        </TouchableOpacity>
      </Animated.View>
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
        <Text style={styles.loadingText}>Loading your matches...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
      <Animated.View style={[styles.header, { transform: [{ translateY: headerSlideAnim }] }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{filteredConversations.length}</Text>
        </View>
      </Animated.View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF5864']}
              tintColor="#FF5864"
              progressBackgroundColor="#1E1E1E"
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
              <Text style={styles.emptyText}>No conversations found</Text>
              <Text style={styles.emptySubtext}>Try searching for a name</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingAnimation: { width: 150, height: 150 },
  loadingText: { color: 'white', fontSize: 16, marginTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 32, fontWeight: '700', color: 'white' },
  headerBadge: {
    backgroundColor: '#FF5864',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadgeText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  searchContainer: {
    paddingHorizontal: 25,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: 'white',
  },
  content: { flex: 1 },
  listContainer: { flexGrow: 1, paddingBottom: 30 },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginHorizontal: 15,
    marginVertical: 5,
    borderRadius: 18,
    backgroundColor: 'rgba(42, 42, 42, 0.7)',
  },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 88, 100, 0.4)',
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
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  miniBadgeIcon: { width: 12, height: 12 },
  conversationInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 18, fontWeight: '600', color: 'white', flex: 1, marginRight: 10 },
  time: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  messageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1, marginRight: 10 },
  unreadMessage: { color: 'white' },
  unreadBadge: {
    backgroundColor: '#FF5864',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  chevron: { marginLeft: 10 },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 30,
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  emptyAnimation: { width: 200, height: 200 },
  emptyText: { fontSize: 22, color: 'white', marginTop: 20 },
  emptySubtext: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center' },
  discoverButton: {
    backgroundColor: '#FF5864',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 16,
  },
  discoverButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default ConversationList;
