import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useDebounce } from 'use-debounce';
import * as Haptics from 'expo-haptics';
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';
import { Swipeable } from 'react-native-gesture-handler';

const DEFAULT_IMAGE = require('../../assets/placeholder.jpg');

const ConversationList = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 200);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const itemAnimations = useRef([]);

  useEffect(() => {
    fetchConversations();
    const sub = setupRealtimeUpdates();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [user]);

  useEffect(() => {
    handleSearch(debouncedSearch);
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
          lastMessage: formatPreview(conv.last_message_text),
          lastMessageTime: conv.last_message_at,
          unreadCount,
          isNew: Date.now() - new Date(conv.last_message_at).getTime() < 60000,
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleSearch = (text) => {
    if (!text.trim()) {
      setFilteredConversations(conversations);
    } else {
      const lower = text.toLowerCase();
      const filtered = conversations.filter((c) =>
        c.otherUser?.full_name?.toLowerCase().includes(lower)
      );
      setFilteredConversations(filtered);
    }
  };

  const formatPreview = (text) => {
    if (!text) return '';
    if (text.startsWith('🖼️')) return '[Photo]';
    if (text.length > 40) return text.slice(0, 40) + '...';
    return text;
  };

  const handleDelete = (conversationId) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('conversations')
              .delete()
              .eq('id', conversationId);
            if (error) console.error('Error deleting:', error);
            else fetchConversations();
          },
        },
      ]
    );
  };

  const renderRightActions = (id) => (
    <TouchableOpacity
      onPress={() => handleDelete(id)}
      style={{
        backgroundColor: '#FF4B4B',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
      }}
    >
      <Ionicons name="trash" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const renderItem = ({ item, index }) => {
    const anim = itemAnimations.current[index] || new Animated.Value(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: anim }] }}>
          <TouchableOpacity
            style={[styles.conversationItem, item.isNew && styles.newConversation]}
            onPress={() => {
              Haptics.selectionAsync();
              navigation.navigate('Chat', {
                conversationId: item.id,
                otherUser: item.otherUser,
              });
            }}
            onLongPress={() => Alert.alert(item.otherUser.full_name)}
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
                  {item.lastMessage}
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
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <SkeletonPlaceholder backgroundColor="#2A2A2A" highlightColor="#3A3A3A">
        {[...Array(5)].map((_, i) => (
          <SkeletonPlaceholder.Item key={i} flexDirection="row" alignItems="center" padding={20}>
            <SkeletonPlaceholder.Item width={60} height={60} borderRadius={30} />
            <SkeletonPlaceholder.Item marginLeft={20}>
              <SkeletonPlaceholder.Item width={120} height={20} borderRadius={4} />
              <SkeletonPlaceholder.Item marginTop={6} width={180} height={14} borderRadius={4} />
            </SkeletonPlaceholder.Item>
          </SkeletonPlaceholder.Item>
        ))}
      </SkeletonPlaceholder>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TextInput
          placeholder="Search by name"
          placeholderTextColor="#999"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

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
              style={{ width: 180, height: 180 }}
            />
            <Text style={styles.emptyText}>No conversations found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  searchInput: {
    backgroundColor: '#2A2A2A',
    color: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  listContainer: { paddingBottom: 30 },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
  },
  newConversation: {
    backgroundColor: '#323232',
  },
  avatarContainer: { marginRight: 15, position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  conversationInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  time: { fontSize: 12, color: '#999' },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: { color: '#ccc', fontSize: 14, flex: 1 },
  unreadMessage: { color: '#fff', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: '#FF5864',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#fff', fontSize: 16, marginTop: 20 },
});

export default ConversationList;
