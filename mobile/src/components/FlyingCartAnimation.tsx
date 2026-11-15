import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing, Image } from 'react-native';
import { useApp } from '../context/AppContext';
import { Colors } from '../theme/colors';
import { Plus } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Cart icon coordinates in header (matches top right header cart button)
const CART_TARGET_X = width - 42;
const CART_TARGET_Y = 46;

/**
 * Snappy flying piece animation from clicked order item to header cart button.
 * 100% matches Web App's `foodies-flying-piece` in styling, 420ms duration, and cubic-bezier curve.
 */
export function FlyingCartAnimation() {
  const { flyingItem, dismissFlyingItem } = useApp();

  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (flyingItem) {
      animProgress.setValue(0);
      Animated.timing(animProgress, {
        toValue: 1,
        duration: 750, // Slower, smooth flight so the customer can clearly follow the piece into the cart
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(() => {
        dismissFlyingItem();
      });
    }
  }, [flyingItem]);

  if (!flyingItem) return null;

  const startX = flyingItem.startX || width / 2;
  const startY = flyingItem.startY || 400;

  const translateX = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX - 13, CART_TARGET_X],
  });

  const translateY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY - 13, CART_TARGET_Y],
  });

  const scale = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.35],
  });

  const opacity = animProgress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [1, 0.85, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyingContainer,
        {
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={styles.particle}>
        {flyingItem.dishImage ? (
          <Image
            source={{ uri: flyingItem.dishImage }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <Plus size={14} color="#FFFFFF" strokeWidth={3} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flyingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999999,
  },
  particle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 10,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
});


