import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, RefreshControl, ScrollView, Modal, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import BottomNavbar from './BottomNavbar';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_IMAGE = require('../../assets/placeholder.jpg');
const ROTATION_RANGE = 15; // Degrees of rotation when swiping

const MatchScreen = () => {
  const { user, authLoading } = useAuth();
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchesRemaining, setMatchesRemaining] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [showNopeAnimation, setShowNopeAnimation] = useState(false);
  
  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const badgeAnimations = useRef({});

  // Animation for badge pulse effect
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Real-time updates for swipes
  useEffect(() => {
    if (!user) return;

    const fetchInterval = setInterval(() => {
      fetchPotentialMatches();
      checkMatchesLimit();
    }, 60000); // Update every minute

    return () => clearInterval(fetchInterval);
  }, [user]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchPotentialMatches();
      checkMatchesLimit();
    }
  }, [user, authLoading]);

  const checkMatchesLimit = async () => {
    if (!user) return;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { data: premiumData } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single();

    if (premiumData?.is_premium) {
      setMatchesRemaining(Infinity);
      return;
    }

    const { count } = await supabase
      .from('swipes')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('action', 'like')
      .gte('timestamp', oneHourAgo);

    const remaining = Math.max(0, 10 - (count || 0));
    setMatchesRemaining(remaining);
  };

  const fetchPotentialMatches = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        return;
      }

      const { data: currentUser, error: userError } = await supabase
        .from('profiles')
        .select('gender_preference, min_age_preference, max_age_preference, location')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const { data: seenProfiles, error: seenError } = await supabase
        .from('swipes')
        .select('target_user_id')
        .eq('user_id', user.id);

      if (seenError) throw seenError;

      const seenIds = seenProfiles?.map(p => p.target_user_id) || [];
      seenIds.push(user.id);

      let query = supabase
        .from('profiles')
        .select(`
          id, 
          full_name, 
          bio, 
          profile_image, 
          birthday,
          gender,
          location,
          badges:badges!profile_id (
            id,
            label,
            description,
            icon_url,
            background_color,
            text_color
          )
        `)
        .neq('id', user.id)
        .eq('is_active', true)
        .eq('is_banned', false)
        .not('id', 'in', `(${seenIds.join(',')})`)
        .limit(20);

      if (currentUser?.gender_preference) {
        query = query.eq('gender', currentUser.gender_preference);
      }

      if (currentUser?.min_age_preference && currentUser?.max_age_preference) {
        const currentYear = new Date().getFullYear();
        const minBirthYear = currentYear - currentUser.max_age_preference;
        const maxBirthYear = currentYear - currentUser.min_age_preference;
        query = query.gte('birth_year', minBirthYear).lte('birth_year', maxBirthYear);
      }

      if (currentUser?.location) {
        query = query.not('location', 'is', null).ilike('location', `%${currentUser.location}%`);
      }

      const { data: potentialMatches, error } = await query;

      if (error) throw error;

      setProfiles(potentialMatches || []);
      if (potentialMatches?.length > 0 && currentIndex >= potentialMatches.length) {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPotentialMatches();
    checkMatchesLimit();
  }, []);
const handleAction = async (action) => {
  if (profiles.length === 0 || !user) return;

  // Check limits based on action type
  if (action === 'like' && matchesRemaining <= 0) {
    Alert.alert('Limit Reached', 'You can only like 10 profiles per hour. Upgrade to premium for unlimited likes.');
    return;
  }

  // For super like, check premium status or remaining super likes
  if (action === 'super_like') {
    const { data: premiumData } = await supabase
      .from('profiles')
      .select('is_premium, super_likes_remaining')
      .eq('id', user.id)
      .single();

    if (!premiumData?.is_premium && (premiumData?.super_likes_remaining || 0) <= 0) {
      Alert.alert('No Super Likes Left', 'You have no super likes remaining. Upgrade to premium for unlimited super likes.');
      return;
    }
  }

  const currentProfile = profiles[currentIndex];
  
  try {
    // Show animation based on action
    if (action === 'like' || action === 'super_like') {
      setShowLikeAnimation(true);
      setTimeout(() => setShowLikeAnimation(false), 1000);
    } else {
      setShowNopeAnimation(true);
      setTimeout(() => setShowNopeAnimation(false), 1000);
    }

    // Prepare swipe data
    const swipeData = {
      user_id: user.id,
      target_user_id: currentProfile.id,
      action: action,
      timestamp: new Date().toISOString(),
      is_undo: false
    };

    // Add device info if available
    // (You would need to implement getDeviceInfo() or use a library like react-native-device-info)
    // swipeData.device_id = getDeviceId();
    // swipeData.ip_address = getIpAddress();

    const { error } = await supabase
      .from('swipes')
      .insert(swipeData);

    if (error) throw error;

    // Handle post-swipe actions
    if (action === 'like' || action === 'super_like') {
      await checkForMatch(currentProfile.id);
      
      // Update remaining counts
      if (action === 'like') {
        setMatchesRemaining(prev => prev - 1);
      } else if (action === 'super_like') {
        // Decrement super like count if not premium
        const { data: premiumData } = await supabase
          .from('profiles')
          .select('is_premium')
          .eq('id', user.id)
          .single();

        if (!premiumData?.is_premium) {
          await supabase.rpc('decrement_super_likes', { user_id: user.id });
        }
      }
    }

    // Move to next profile
    const nextIndex = currentIndex + 1;
    if (nextIndex < profiles.length) {
      setCurrentIndex(nextIndex);
    } else {
      fetchPotentialMatches();
    }
  } catch (error) {
    console.error('Action error:', error);
    Alert.alert('Error', 'Failed to record swipe. Please try again.');
  }
};


const checkForMatch = async (targetUserId) => {
  try {
    const { data, error } = await supabase
      .from('swipes')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('target_user_id', user.id)
      .eq('action', 'like')
      .maybeSingle();

    if (error) throw error;

    if (data) {
      // Create match record
      await supabase.from('matches').insert({
        user1_id: user.id,
        user2_id: targetUserId,
        matched_at: new Date().toISOString()
      });
      
      // Create conversation and get the conversation ID
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          user1_id: user.id,
          user2_id: targetUserId,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) throw convError;

      // Navigate to MatchModal with all needed data
      navigation.navigate('MatchModal', {
        matchedUser: profiles[currentIndex],
        currentUser: user,
        conversationId: conversation.id
      });
    }
  } catch (error) {
    console.error('Match check error:', error);
  }
};

  const calculateAge = (birthday) => {
    if (!birthday) return '?';
    const birthDate = new Date(birthday);
    const ageDiff = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const handleBadgePress = (badge) => {
    setSelectedBadge(badge);
    setBadgeModalVisible(true);
  };

  const renderBadgeModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={badgeModalVisible}
      onRequestClose={() => setBadgeModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackground} 
          activeOpacity={1}
          onPress={() => setBadgeModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setBadgeModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            
            <View style={[
              styles.modalBadge,
              { 
                backgroundColor: selectedBadge?.background_color || '#FF5864',
                borderColor: selectedBadge?.text_color || 'white'
              }
            ]}>
              {selectedBadge?.icon_url ? (
                <Image
                  source={{ uri: selectedBadge.icon_url }}
                  style={styles.modalBadgeIcon}
                />
              ) : (
                <Ionicons name="ribbon" size={40} color={selectedBadge?.text_color || 'white'} />
              )}
              <Text style={[
                styles.modalBadgeText,
                { color: selectedBadge?.text_color || 'white' }
              ]}>
                {selectedBadge?.label}
              </Text>
            </View>
            
            <Text style={styles.modalTitle}>About This Badge</Text>
            <Text style={styles.modalDescription}>
              {selectedBadge?.description || 'This badge represents a special achievement or characteristic of the user.'}
            </Text>
            
            <View style={styles.modalStats}>
        
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  const renderCard = () => {
    if (authLoading) {
      return (
        <View style={styles.loadingCard}>
          <LinearGradient colors={['#2A2A2A', '#1E1E1E']} style={styles.gradientBackground}>
            <LottieView
              source={require('../../assets/animations/loading.json')}
              autoPlay
              loop
              style={styles.loadingAnimation}
            />
            <Text style={styles.loadingText}>Loading your dating experience...</Text>
          </LinearGradient>
        </View>
      );
    }

    if (!user) {
      return (
        <View style={styles.noMoreCards}>
          <LinearGradient colors={['#2A2A2A', '#1E1E1E']} style={styles.gradientBackground}>
            <Ionicons name="heart-dislike" size={60} color="#FF5864" />
            <Text style={styles.noMoreCardsText}>Please log in to view matches</Text>
          </LinearGradient>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingCard}>
          <LinearGradient colors={['#2A2A2A', '#1E1E1E']} style={styles.gradientBackground}>
            <LottieView
              source={require('../../assets/animations/searching.json')}
              autoPlay
              loop
              style={styles.loadingAnimation}
            />
            <Text style={styles.loadingText}>Finding your perfect matches...</Text>
          </LinearGradient>
        </View>
      );
    }

    if (profiles.length === 0) {
      return (
        <View style={styles.noMoreCards}>
          <LinearGradient colors={['#2A2A2A', '#1E1E1E']} style={styles.gradientBackground}>
            <LottieView
              source={require('../../assets/animations/empty.json')}
              autoPlay
              loop
              style={styles.emptyAnimation}
            />
            <Text style={styles.noMoreCardsText}>No more profiles nearby</Text>
            <Text style={styles.noMoreCardsSubtext}>Check back later or adjust your preferences</Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchPotentialMatches}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      );
    }

    const profile = profiles[currentIndex];
    
    return (
      <>
        {showLikeAnimation && (
          <View style={styles.overlayAnimationContainer}>
            <LottieView
              source={require('../../assets/animations/like.json')}
              autoPlay
              loop={false}
              style={styles.fullScreenAnimation}
            />
          </View>
        )}
        
        {showNopeAnimation && (
          <View style={styles.overlayAnimationContainer}>
            <LottieView
              source={require('../../assets/animations/nope.json')}
              autoPlay
              loop={false}
              style={styles.fullScreenAnimation}
            />
          </View>
        )}
        
        {profiles.length > currentIndex + 1 && (
          <View style={styles.nextCard}>
            <Image 
              source={profiles[currentIndex + 1].profile_image ? 
                { uri: profiles[currentIndex + 1].profile_image } : DEFAULT_IMAGE}
              style={styles.cardImage}
              resizeMode="cover"
            />
          </View>
        )}
        
        <View style={styles.card}>
          <Image 
            source={profile.profile_image ? { uri: profile.profile_image } : DEFAULT_IMAGE}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.8)']} 
            style={styles.cardGradient} 
          />
          
          <View style={styles.cardInfo}>
            <View style={styles.nameLocation}>
              <Text style={styles.cardName}>
                {profile.full_name}, {calculateAge(profile.birthday)}
              </Text>
              {profile.location && (
                <View style={styles.location}>
                  <Ionicons name="location" size={16} color="white" />
                  <Text style={styles.locationText}>{profile.location}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardBio}>
              {profile.bio || 'No bio yet'}
            </Text>
          </View>

          <View style={styles.badgeContainer}>
            {profile.badges?.filter(b => b).map((badge, index) => (
              <TouchableOpacity
                key={`${profile.id}-badge-${index}`}
                onPress={() => handleBadgePress(badge)}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.badge,
                    { 
                      backgroundColor: badge.background_color || '#FF5864',
                      opacity: badge.background_color ? 1 : 0.8,
                      transform: [{ scale: pulseAnim }]
                    }
                  ]}
                >
                  {badge.icon_url ? (
                    <Image
                      source={{ uri: badge.icon_url }}
                      style={styles.badgeIcon}
                    />
                  ) : (
                    <Ionicons name="ribbon" size={16} color={badge.text_color || 'white'} />
                  )}
                  <Text
                    style={[
                      styles.badgeText,
                      { color: badge.text_color || 'white' }
                    ]}
                  >
                    {badge.label}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF5864']}
            tintColor="#FF5864"
          />
        }
      >
        <LinearGradient colors={['#1a1a1a', '#121212']} style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Discover</Text>
            {matchesRemaining !== Infinity && (
              <View style={styles.limitContainer}>
                <Ionicons name="time" size={16} color="#FF5864" />
                <Text style={styles.matchesLimit}>
                  {matchesRemaining > 0 
                    ? `${matchesRemaining} likes remaining` 
                    : 'Come back in an hour for more likes'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardContainer}>
            {renderCard()}
          </View>
<View style={styles.actions}>
  <TouchableOpacity 
    style={styles.actionButton} 
    onPress={() => handleAction('pass')}
    activeOpacity={0.7}
    
  >
    
        <View style={styles.buttonCircle}>

 <LottieView
                  ref={ref => badgeAnimations.current.star = ref}
                  source={require('../../assets/animations/nope.json')}
                  autoPlay
                  loop
                  style={styles.starAnimation}
                />

                </View>
  </TouchableOpacity>

  <TouchableOpacity 
    style={styles.actionButton} 
    onPress={() => handleAction('super_like')}
    activeOpacity={0.7}
  >
        <View style={styles.buttonCircle}>

 <LottieView
                  ref={ref => badgeAnimations.current.star = ref}
                  source={require('../../assets/animations/star.json')}
                  autoPlay
                  loop
                  style={styles.starAnimation}
                />
                </View>
  </TouchableOpacity>

  <TouchableOpacity 
    style={styles.actionButton} 
    onPress={() => {
      if (matchesRemaining <= 0) {
        Alert.alert('Limit Reached', 'You can only like 10 profiles per hour. Upgrade to premium for unlimited likes.');
        return;
      }
      handleAction('like');
    }}
    activeOpacity={0.7}
  >
        <View style={styles.buttonCircle}>

  <LottieView
                  ref={ref => badgeAnimations.current.star = ref}
                  source={require('../../assets/animations/like.json')}
                  autoPlay
                  loop
                  style={styles.starAnimation}
                />
  </View></TouchableOpacity>
  
</View>
        </LinearGradient>
      </ScrollView>
      
      <BottomNavbar
        items={[
          {
            name: 'Discover',
            icon: 'home',
            isActive: true,
            onPress: () => navigation.navigate('MatchScreen'),
          },
          {
            name: 'Messages',
            icon: 'chatbubbles',
            isActive: false,
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
      
      {renderBadgeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    backgroundColor: "#121212",
    height: '100%',
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  container: {
    flex: 1,
    minHeight: '100%',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  limitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom:1,
    backgroundColor: 'rgba(255, 88, 100, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  matchesLimit: {
    fontSize: 14,
    color: '#FF5864',
    marginLeft: 6,
    textAlign: 'center',
    fontFamily: 'HelveticaNowDisplay-Medium',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    marginTop:60,
    position: 'relative',
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
    backgroundColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  nextCard: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    position: 'absolute',
    opacity: 0.8,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  nameLocation: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-Bold',
    marginRight: 10,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 4,
    fontFamily: 'HelveticaNowDisplay-Regular',
  },
  cardBio: {
    fontSize: 16,
    color: 'white',
    lineHeight: 22,
    fontFamily: 'HelveticaNowDisplay-Regular',
  },
  badgeContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FF5864',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'HelveticaNowDisplay-Medium',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    paddingBottom: 30,
  },
  actionButton: {
    padding: 0,
  
  },
  buttonCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingCard: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  noMoreCards: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 20,
  },
  noMoreCardsText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'HelveticaNowDisplay-Bold',
    marginTop: 20,
  },
  noMoreCardsSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontFamily: 'HelveticaNowDisplay-Regular',
    marginBottom: 20,
  },
  refreshButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#FF5864',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'HelveticaNowDisplay-Bold',
    fontSize: 16,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'HelveticaNowDisplay-Medium',
    marginTop: 20,
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  emptyAnimation: {
    width: 200,
    height: 200,
  },
  starAnimation: {
    width: 60,
    height: 60,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  modalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 20,
  },
  modalBadgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  modalBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  modalDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    fontFamily: 'HelveticaNowDisplay-Regular',
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 15,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5864',
    fontFamily: 'HelveticaNowDisplay-Bold',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 5,
    fontFamily: 'HelveticaNowDisplay-Regular',
  },
  overlayAnimationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'transparent',
  },
  fullScreenAnimation: {
    width: '100%',
    height: '100%',
  },
});

export default MatchScreen;