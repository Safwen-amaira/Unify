import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_IMAGE = require('../../assets/placeholder.jpg');

const MatchModal = ({ route }) => {
  const navigation = useNavigation();
  const { matchedUser, currentUser, conversationId } = route.params;
  
  const scaleAnim = new Animated.Value(0.8);
  const fadeAnim = new Animated.Value(0);
  const slideUpAnim = new Animated.Value(50);
  const heartBeatAnim = new Animated.Value(1);

  Animated.parallel([
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }),
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }),
    Animated.timing(slideUpAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }),
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartBeatAnim, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartBeatAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start(),
  ]).start();

  const handleSendMessage = () => {
    navigation.reset({
      index: 0,
      routes: [
        { name: 'Main' },
        { 
          name: 'Chat', 
          params: { 
            conversationId: conversationId,
            otherUser: matchedUser 
          }
        }
      ],
    });
  };

  const handleKeepSwiping = () => {
    navigation.goBack();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={handleKeepSwiping}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <LinearGradient 
          colors={['rgba(26, 26, 26, 0.9)', 'rgba(18, 18, 18, 0.95)']}
          style={StyleSheet.absoluteFill}
        />
        
        <Animated.View style={[
          styles.modalContainer,
          { 
            transform: [
              { scale: scaleAnim },
              { translateY: slideUpAnim }
            ] 
          }
        ]}>
          <Animated.View style={[styles.animationContainer, { transform: [{ scale: heartBeatAnim }] }]}>
            <LottieView
              source={require('../../assets/animations/Match.json')}
              autoPlay
              loop={false}
              style={styles.animation}
            />
          </Animated.View>
          
          <View style={styles.textContainer}>
            <Text style={styles.matchText}>It's a match!</Text>
            <Text style={styles.subText}>
              You and <Text style={styles.highlightText}>{matchedUser.full_name}</Text> liked each other
            </Text>
          </View>
          
          <View style={styles.profilesContainer}>
            <Animated.View style={[styles.profileImageContainer, { transform: [{ scale: scaleAnim }] }]}>
              <Image
                source={{ uri: currentUser.profile_image || DEFAULT_IMAGE }}
                style={styles.profileImage}
              />
              <View style={styles.onlineIndicator} />
            </Animated.View>
            
            <View style={styles.connectingLine} />
            
            <Animated.View style={[styles.profileImageContainer, { transform: [{ scale: scaleAnim }] }]}>
              <Image
                source={{ uri: matchedUser.profile_image || DEFAULT_IMAGE }}
                style={styles.profileImage}
              />
              <View style={styles.onlineIndicator} />
            </Animated.View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.keepSwipingButton]}
              onPress={handleKeepSwiping}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-undo" size={20} color="white" />
              <Text style={styles.buttonText}>Keep Swiping</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.sendMessageButton]}
              onPress={handleSendMessage}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="white" />
              <Text style={styles.buttonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
          
          {matchedUser.badges?.length > 0 && (
            <View style={styles.commonInterestsContainer}>
              <Text style={styles.commonInterestsTitle}>You both have:</Text>
              <View style={styles.badgesContainer}>
                {matchedUser.badges.slice(0, 3).map((badge, index) => (
                  <View key={index} style={[
                    styles.badge,
                    { backgroundColor: badge.background_color || '#FF5864' }
                  ]}>
                    {badge.icon_url ? (
                      <Image
                        source={{ uri: badge.icon_url }}
                        style={styles.badgeIcon}
                      />
                    ) : (
                      <Ionicons name="ribbon" size={16} color={badge.text_color || 'white'} />
                    )}
                    <Text style={[
                      styles.badgeText,
                      { color: badge.text_color || 'white' }
                    ]}>
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    backgroundColor: '#1E1E1E',
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 88, 100, 0.2)',
  },
  animationContainer: {
    position: 'absolute',
    top: -100,
    zIndex: 10,
  },
  animation: {
    width: 250,
    height: 250,
  },
  textContainer: {
    marginTop: 60,
    marginBottom: 30,
    alignItems: 'center',
  },
  matchText: {
    fontSize: 36,
    fontWeight: '800',
    color: 'white',
    fontFamily: 'HelveticaNowDisplay-ExtraBold',
    textShadowColor: 'rgba(255, 88, 100, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 8,
  },
  subText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'HelveticaNowDisplay-Medium',
    textAlign: 'center',
  },
  highlightText: {
    color: '#FF5864',
    fontWeight: 'bold',
  },
  profilesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF5864',
    marginHorizontal: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#1E1E1E',
  },
  connectingLine: {
    position: 'absolute',
    height: 2,
    width: 40,
    backgroundColor: '#FF5864',
    opacity: 0.6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 15,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  keepSwipingButton: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendMessageButton: {
    backgroundColor: '#FF5864',
    shadowColor: '#FF5864',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'HelveticaNowDisplay-Bold',
    marginLeft: 8,
  },
  commonInterestsContainer: {
    width: '100%',
    marginTop: 10,
  },
  commonInterestsTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'HelveticaNowDisplay-Regular',
    marginBottom: 10,
    textAlign: 'center',
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 4,
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
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'HelveticaNowDisplay-Medium',
  },
});

export default MatchModal;