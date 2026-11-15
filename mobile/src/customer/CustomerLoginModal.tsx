import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../services/api';
import { saveSecureAuthToken } from '../services/secureTokenStore';
import { Mail, X, Check, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react-native';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';

interface CustomerLoginModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CustomerLoginModal({ visible, onClose, onSuccess }: CustomerLoginModalProps) {
  const { loginCustomer, showToast, setBottomSheetOpen } = useApp();

  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [visible, setBottomSheetOpen]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!visible) return null;

  const handleSendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      showToast('Please enter a valid email address (e.g. name@gmail.com)', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({
          action: 'send',
          email: cleanEmail,
        }),
      });

      if (res.ok) {
        setEmailToken(res.data?.emailToken || '');
        setStep('otp');
        setResendCountdown(30);
        showToast('Verification code sent! (Use demo code 1234 or 5829)', 'success');
      } else {
        // Even if SMTP fails on local dev, allow proceeding with demo bypass
        setStep('otp');
        setResendCountdown(30);
        showToast('Verification code requested. Use demo code 1234 to sign in', 'info');
      }
    } catch (_err) {
      setStep('otp');
      setResendCountdown(30);
      showToast('Offline mode: use demo code 1234 to sign in', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length < 4) {
      showToast('Please enter the 4-digit verification code', 'warning');
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    // Fast-path bypass for demo/testing
    if (code === '1234' || code === '5829') {
      completeSignIn();
      return;
    }

    try {
      const res = await apiFetch('/api/auth/email', {
        method: 'POST',
        body: JSON.stringify({
          action: 'verify',
          email: cleanEmail,
          code,
          emailToken,
          platform: 'app',
        }),
      });

      if (res.ok) {
        if (res.data?.sessionToken) {
          await saveSecureAuthToken(res.data.sessionToken);
        }
        completeSignIn();
      } else {
        showToast(res.error || 'Invalid verification code. Try demo code 1234', 'danger');
        setLoading(false);
      }
    } catch (_err) {
      // In offline scenario, accept 1234
      if (code === '1234') {
        completeSignIn();
      } else {
        showToast('Could not verify code. Enter 1234 to continue', 'warning');
        setLoading(false);
      }
    }
  };

  const completeSignIn = () => {
    const cleanEmail = email.trim().toLowerCase();
    const usernamePart = cleanEmail.split('@')[0];
    const derivedName = usernamePart
      ? usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1)
      : 'Customer';

    const customerUser = {
      id: `cust-${Date.now().toString().slice(-6)}`,
      name: derivedName,
      email: cleanEmail,
      phone: '',
      role: 'customer' as const,
      status: 'active' as const,
    };

    loginCustomer(customerUser);
    setLoading(false);
    setStep('info');
    setOtpCode('');
    showToast(`Welcome back, ${customerUser.name}!`, 'success');
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={true}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandTitle}>Foodies<Text style={styles.brandHighlight}>Cafe</Text></Text>
              <Text style={styles.headerSubtitle}>
                {step === 'info' ? 'Customer Sign In' : 'Verify Email Code'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {step === 'info' ? (
              <View>
                <Text style={styles.instructions}>
                  Sign in with your email to track your live kitchen orders, save delivery locations, and view past order history.
                </Text>

                {/* Email Address */}
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputBox}>
                  <Mail size={16} color={Colors.primary} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. zeeshan@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                {/* Quick Auto-Fill Demo Button */}
                <TouchableOpacity
                  style={styles.demoFillBtn}
                  onPress={() => {
                    setEmail('zeeshan@example.com');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoFillText}>✨ Quick Fill Demo Email (zeeshan@example.com)</Text>
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSendCode}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <>
                      <Text style={styles.submitBtnText}>Send Verification Code</Text>
                      <ArrowRight size={16} color={Colors.textWhite} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.otpNoticeBox}>
                  <ShieldCheck size={20} color={Colors.primary} />
                  <Text style={styles.otpNoticeText}>
                    A 4-digit code was sent to <Text style={{ fontWeight: '800' }}>{email}</Text>. Check your inbox or spam folder.
                  </Text>
                </View>

                <View style={styles.demoCodeBadge}>
                  <Text style={styles.demoCodeBadgeText}>💡 Tip: You can also enter master demo code 1234 or 5829</Text>
                </View>

                <Text style={styles.inputLabel}>Enter 4-Digit Code</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="• • • •"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                />

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textWhite} size="small" />
                  ) : (
                    <>
                      <Check size={16} color={Colors.textWhite} />
                      <Text style={styles.submitBtnText}>Verify & Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Resend Code / Change Email */}
                <View style={styles.otpActionsRow}>
                  <TouchableOpacity
                    onPress={() => setStep('info')}
                    style={styles.textActionBtn}
                  >
                    <Text style={styles.textActionLabel}>Change Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSendCode}
                    disabled={resendCountdown > 0}
                    style={styles.textActionBtn}
                  >
                    <RefreshCw size={12} color={resendCountdown > 0 ? Colors.textMuted : Colors.primary} />
                    <Text
                      style={[
                        styles.textActionLabel,
                        resendCountdown > 0 && { color: Colors.textMuted },
                      ]}
                    >
                      {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <HistoricalLoadingModal visible={loading && visible} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textMain,
  },
  brandHighlight: {
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 30,
  },
  instructions: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
    marginTop: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
  },
  demoFillBtn: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  demoFillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '800',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 46,
    marginTop: 20,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  otpNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginBottom: 14,
  },
  otpNoticeText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMain,
    lineHeight: 16,
  },
  demoCodeBadge: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  demoCodeBadgeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  otpInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: 12,
    height: 52,
    marginTop: 6,
  },
  otpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  textActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  textActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
});

