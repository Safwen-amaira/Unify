import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import {  useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
const { width } = Dimensions.get('window');

const onboardingSlides = [
  {
    id: 1,
    title: "Find Your Match",
    description: "Swipe right to like someone, left to pass.",
    color: ["#FF5864", "#FD297B"],
  },
  {
    id: 2,
    title: "Chat Securely",
    description: "Message only when you both match.",
    color: ["#FD297B", "#FF655B"],
  },
  {
    id: 3,
    title: "Meet Up Safely",
    description: "Set dates in public places.",
    color: ["#FF655B", "#FF5864"],
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigation = useNavigation();

  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<Animated.FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    setCurrentIndex(viewableItems[0]?.index || 0);
  }).current;

  const scrollTo = () => {
    if (currentIndex < onboardingSlides.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      AsyncStorage.setItem('@viewedOnboarding', 'true');
      navigation.navigate("Home");

    }
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={onboardingSlides}
        renderItem={({ item }) => (
          <View style={{ width, alignItems: 'center' }}>
            <LinearGradient
              colors={item.color}
              style={styles.slide}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </LinearGradient>
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={viewableItemsChanged}
        ref={slidesRef}
      />

      <View style={styles.footer}>


        <View style={styles.pagination}>
          {onboardingSlides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 16, 8],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth }]}
              />
            );
          })}
        </View>

        <Text 
          style={styles.button} 
          onPress={scrollTo}
        >
          {currentIndex === onboardingSlides.length - 1 ? "Get Started" : "Next"}
        </Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  slide: {
    width: width - 40,
    height: '70%',
    marginTop: 60,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5864',
    marginHorizontal: 4,
  },
  button: {
    fontSize: 18,
    color: '#FF5864',
    fontWeight: 'bold',
    marginTop: 20,
  },
});