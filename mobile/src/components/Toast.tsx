import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar as RNStatusBar, Animated, PanResponder, Dimensions } from 'react-native';
import { useApp } from '../context/AppContext';
import { Colors } from '../theme/colors';
import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react-native';

export function Toast() {
  const { toast, headerHeight, dismissToast } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;
  // Swipe right to dismiss (like the phone's notification shade).
  const swipeX = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(dismissToast);
  dismissRef.current = dismissToast;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => swipeX.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_e, g) => {
        const width = Dimensions.get('window').width;
        if (g.dx > width * 0.25 || g.vx > 0.6) {
          Animated.timing(swipeX, { toValue: width, duration: 160, useNativeDriver: true }).start(() => {
            dismissRef.current();
            swipeX.setValue(0);
          });
        } else {
          Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(-8);
    }
    swipeX.setValue(0);
  }, [toast]);

  if (!toast) return null;

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: Colors.successLight,
          border: Colors.successBorder,
          text: Colors.success,
          icon: CheckCircle,
        };
      case 'danger':
        return {
          bg: Colors.dangerLight,
          border: Colors.dangerBorder,
          text: Colors.danger,
          icon: AlertCircle,
        };
      case 'warning':
        return {
          bg: Colors.warningLight,
          border: Colors.warningBorder,
          text: Colors.warning,
          icon: AlertTriangle,
        };
      case 'info':
      default:
        return {
          bg: Colors.infoLight,
          border: Colors.infoBorder,
          text: Colors.info,
          icon: Info,
        };
    }
  };

  const styleConfig = getStyle();
  const IconComponent = styleConfig.icon;
  const defaultHeader = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 30) + 64 : 100;
  const topPosition = (headerHeight && headerHeight > 0 ? headerHeight : defaultHeader) + 10;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          top: topPosition,
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateX: swipeX }],
        },
      ]}
    >
      <IconComponent size={16} color={styleConfig.text} />
      <Text style={[styles.message, { color: styleConfig.text }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 8,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 8,
  },
  message: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});

