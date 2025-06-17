import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type NavItem = {
  name: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
};

type BottomNavbarProps = {
  items: NavItem[];
};

const BottomNavbar: React.FC<BottomNavbarProps> = ({ items }) => {
  return (
    <View style={styles.navbar}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.navItem}
          onPress={item.onPress}
        >
          <Ionicons
            name={item.icon as any}
            size={24}
            color={item.isActive ? '#FF5864' : '#888'}
          />
          <Text
            style={[
              styles.navText,
              item.isActive && styles.activeNavText,
            ]}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 10,
    paddingBottom: 20, // Extra padding for iPhone home indicator
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
  },
  activeNavText: {
    color: '#FF5864',
    fontWeight: '600',
  },
});

export default BottomNavbar;