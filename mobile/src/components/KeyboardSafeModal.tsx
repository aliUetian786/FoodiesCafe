import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, ModalProps, StyleSheet } from 'react-native';

/**
 * Drop-in replacement for React Native's <Modal> that lifts its content above the on-screen keyboard.
 *
 * Android runs edge-to-edge (Expo SDK 54+), so the window no longer resizes for the keyboard and inputs
 * near the bottom (email, OTP, phone, name, address…) ended up hidden behind it. Modals are separate
 * native windows, so a KeyboardAvoidingView at the app root cannot reach them: every modal needs its own.
 * 'padding' shrinks the area the modal content lives in, so bottom sheets ride up and centred cards
 * re-centre in the space left above the keyboard. Inner ScrollViews then keep the focused input in view.
 */
export function KeyboardSafeModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** True while the on-screen keyboard is showing. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
