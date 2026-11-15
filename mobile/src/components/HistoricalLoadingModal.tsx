import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Colors } from '../theme/colors';

interface HistoricalLoadingModalProps {
  visible: boolean;
  title?: string;
  message?: string;
}

// Minimal loader: only a fast-rotating circular arc, no background pod.
export function HistoricalLoadingModal({ visible }: HistoricalLoadingModalProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 550,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spin]);

  if (!visible) return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay} pointerEvents="none">
        <Animated.View style={[styles.arc, { transform: [{ rotate }] }]} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: Colors.primary,
    borderRightColor: Colors.primary,
  },
});
