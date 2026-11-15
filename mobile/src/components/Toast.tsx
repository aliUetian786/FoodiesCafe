import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar as RNStatusBar, Animated } from 'react-native';
import { useApp } from '../context/AppContext';
import { Colors } from '../theme/colors';
import { CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react-native';

export function Toast() {
  const { toast, headerHeight } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;

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
      style={[
        styles.container,
        {
          top: topPosition,
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
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

