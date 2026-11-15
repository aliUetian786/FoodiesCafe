import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Linking,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { User, Phone, Mail, Pencil, X, Shield, LogOut, Check, LogIn, Plus, Trash2, MapPin, PhoneCall, AlertTriangle, Clock, XCircle, ShoppingBag, Bell, CheckCheck } from 'lucide-react-native';
import { CustomerLoginModal } from './CustomerLoginModal';
import { DeliveryMapModal } from '../components/DeliveryMapModal';
import { getCancellationAttribution } from '../types';

export function CustomerProfile() {
  const {
    currentUser,
    customerUser,
    isCustomerLoggedIn,
    logoutCustomer,
    updateCurrentUser,
    showToast,
    setAppMode,
    savedAddresses,
    deleteSavedAddress,
    orders,
    branches,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    openNotificationModal,
    setBottomSheetOpen,
  } = useApp();

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [deliveryMapModalVisible, setDeliveryMapModalVisible] = useState(false);

  React.useEffect(() => {
    if (!editModalVisible && !contactModalVisible) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [editModalVisible, contactModalVisible, setBottomSheetOpen]);
  const [editName, setEditName] = useState(currentUser.name || '');
  const [editPhone, setEditPhone] = useState(currentUser.phone || '');
  const [editEmail, setEditEmail] = useState(currentUser.email || '');

  const cleanPhone = (customerUser?.phone || currentUser?.phone || '').replace(/\D/g, '').slice(-10);

  const customerRecentOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const matchesId = (customerUser?.id && o.customerId === customerUser.id) || (currentUser?.id && currentUser.id !== 'guest' && o.customerId === currentUser.id);
        const matchesPhone = cleanPhone && o.customerPhone && o.customerPhone.replace(/\D/g, '').slice(-10) === cleanPhone;
        const matchesEmail = (customerUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === customerUser.email.toLowerCase()) ||
                             (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase());
        const matchesName = (customerUser?.name && o.customerName === customerUser.name) ||
                            (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name);
        return matchesId || matchesPhone || matchesEmail || matchesName;
      })
      .slice(0, 3);
  }, [orders, currentUser, customerUser, cleanPhone]);

  const recentCancelledOrder = useMemo(() => {
    return customerRecentOrders.find((o) => o.status === 'cancelled');
  }, [customerRecentOrders]);

  const [smsUpdates, setSmsUpdates] = useState(true);
  const [promoDeals, setPromoDeals] = useState(true);

  const handleOpenEdit = () => {
    setEditName(currentUser.name || '');
    setEditPhone(currentUser.phone || '');
    setEditEmail(currentUser.email || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    updateCurrentUser({
      name: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
    });
    setEditModalVisible(false);
  };

  const handleSignOut = () => {
    logoutCustomer();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Customer Profile</Text>
      <Text style={styles.pageSub}>Manage your account details and dining preferences</Text>

      {/* ================= LOGGED IN PROFILE CARD ================= */}
      {isCustomerLoggedIn ? (
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitial}>
              {(currentUser.name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Name row with Edit sign next to name */}
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <TouchableOpacity
              style={styles.editPencilBtn}
              onPress={handleOpenEdit}
              activeOpacity={0.7}
            >
              <Pencil size={15} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userRole}>Loyal Customer • Foodies Gold Tier</Text>

          {/* Display Phone & Email */}
          <View style={styles.infoPillsWrap}>
            {currentUser.phone ? (
              <View style={styles.infoPill}>
                <Phone size={13} color={Colors.primary} />
                <Text style={styles.infoPillText}>{currentUser.phone}</Text>
              </View>
            ) : null}
            {currentUser.email ? (
              <View style={styles.infoPill}>
                <Mail size={13} color={Colors.primary} />
                <Text style={styles.infoPillText}>{currentUser.email}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        /* ================= GUEST CUSTOMER CARD ================= */
        <View style={styles.guestCard}>
          <View style={styles.guestAvatarWrap}>
            <User size={30} color={Colors.textMuted} />
          </View>
          <Text style={styles.guestTitle}>Browsing as Guest Customer</Text>
          <Text style={styles.guestSub}>
            Sign in with your email & mobile number to track live orders across devices and save delivery locations.
          </Text>

          <TouchableOpacity
            style={styles.signInPrimaryBtn}
            onPress={() => setLoginModalVisible(true)}
            activeOpacity={0.85}
          >
            <LogIn size={16} color={Colors.textWhite} />
            <Text style={styles.signInPrimaryBtnText}>Sign In / Register with Email & Phone</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= SAVED DELIVERY ADDRESSES ================= */}
      <View style={styles.formCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Saved Delivery Addresses</Text>
          <TouchableOpacity
            style={styles.addAddressPill}
            onPress={() => setDeliveryMapModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus size={12} color={Colors.primary} />
            <Text style={styles.addAddressPillText}>+ Add Address</Text>
          </TouchableOpacity>
        </View>

        {savedAddresses.length === 0 ? (
          <Text style={styles.emptyAddressText}>
            No saved addresses yet. Save locations for 1-tap fast delivery.
          </Text>
        ) : (
          savedAddresses.map((addr) => (
            <View key={addr.id} style={styles.profileAddressCard}>
              <View style={styles.profileAddressTop}>
                <View style={styles.profileAddressLabelWrap}>
                  <MapPin size={13} color={Colors.primary} />
                  <Text style={styles.profileAddressLabel}>{addr.label}</Text>
                </View>
                {savedAddresses.length > 1 && (
                  <TouchableOpacity
                    onPress={() => deleteSavedAddress(addr.id)}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={13} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.profileAddressLine}>{addr.address}</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent Orders Status Section */}
      {customerRecentOrders.length > 0 && (
        <View style={styles.formCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={styles.sectionHeader}>Recent Orders & Live Status</Text>
          </View>

          <View style={{ gap: 8 }}>
            {customerRecentOrders.map((ord) => {
              const isCancelled = ord.status === 'cancelled';
              const cancelAttr = isCancelled ? getCancellationAttribution(ord) : null;
              const isCompleted = ['completed', 'delivered', 'served'].includes(ord.status);

              return (
                <View
                  key={ord.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: isCancelled ? '#FEF2F2' : Colors.bgSubtle,
                    borderWidth: 1,
                    borderColor: isCancelled ? '#FCA5A5' : Colors.borderColor,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '800', fontSize: 13, color: Colors.textMain, fontFamily: 'monospace' }}>
                      #{ord.orderNumber}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: isCancelled ? '#FEE2E2' : isCompleted ? '#DCFCE7' : '#FEF3C7',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: isCancelled ? '#DC2626' : isCompleted ? '#166534' : '#92400E',
                        }}
                      >
                        {isCancelled ? (cancelAttr?.badge || 'CANCELLED') : ord.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: isCancelled ? '#991B1B' : Colors.textSecondary, marginTop: 4 }}>
                    {isCancelled
                      ? (cancelAttr?.isCustomer
                          ? 'Cancelled by you before fulfillment.'
                          : (cancelAttr?.badge === 'CANCELLED (BRANCH CLOSED)'
                              ? 'Order cancelled because the branch went offline before receipt.'
                              : 'Order cancelled by cafe staff before receipt.'))
                      : `${ord.type.toUpperCase().replace('_', ' ')} · Rs. ${ord.total.toLocaleString()}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Notifications Row: Single entry point for Notification Inbox & Preferences */}
      <TouchableOpacity
        style={styles.notificationCard}
        onPress={() => openNotificationModal('inbox')}
        activeOpacity={0.85}
      >
        <View style={styles.notificationIconWrap}>
          <Bell size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.notificationCardTitle}>Notifications</Text>
            {unreadNotificationsCount > 0 && (
              <View style={styles.unreadBadgePill}>
                <Text style={styles.unreadBadgePillText}>{unreadNotificationsCount} NEW</Text>
              </View>
            )}
          </View>
          <Text style={styles.notificationCardSub}>
            {unreadNotificationsCount > 0
              ? `${unreadNotificationsCount} unread alert${unreadNotificationsCount > 1 ? 's' : ''} • Notification inbox & preferences`
              : 'Inbox for notifications & alert preferences'}
          </Text>
        </View>
        <Text style={styles.staffAppArrow}>➔</Text>
      </TouchableOpacity>

      {/* Contact Us: Customer Support & Branch Locations (Below Notification) */}
      <TouchableOpacity
        style={styles.contactUsCard}
        onPress={() => setContactModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.contactIconWrap}>
          <PhoneCall size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactCardTitle}>Contact Us</Text>
          <Text style={styles.contactCardSub}>Customer support helpline & branch locations</Text>
        </View>
        <Text style={styles.staffAppArrow}>➔</Text>
      </TouchableOpacity>

      {/* Dedicated Staff App Entry */}
      <TouchableOpacity
        style={styles.staffAppSwitchCard}
        onPress={() => setAppMode('staff')}
        activeOpacity={0.85}
      >
        <View style={styles.staffIconWrap}>
          <Shield size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.staffAppSwitchTitle}>Switch to Staff App</Text>
          <Text style={styles.staffAppSwitchSub}>Login with staff credentials (Owner, Waiter, Rider)</Text>
        </View>
        <Text style={styles.staffAppArrow}>➔</Text>
      </TouchableOpacity>

      {/* Sign Out Button (Only displayed when logged in) */}
      {isCustomerLoggedIn && (
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out of Customer Account</Text>
        </TouchableOpacity>
      )}

      {/* Customer Login Modal */}
      <CustomerLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
      />

      {/* Edit Profile Pop-Up Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputBox}>
                <User size={16} color={Colors.primary} />
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Full Name"
                />
              </View>

              <Text style={styles.inputLabel}>Mobile Number (🇵🇰 +92)</Text>
              <View style={styles.inputBox}>
                <Phone size={16} color={Colors.primary} />
                <TextInput
                  style={styles.input}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                  placeholder="0300 1234567"
                />
              </View>

              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputBox}>
                <Mail size={16} color={Colors.primary} />
                <TextInput
                  style={styles.input}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  placeholder="name@example.com"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveEdit}>
                <Check size={16} color={Colors.textWhite} />
                <Text style={styles.saveModalText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delivery Map Modal for adding new address from profile */}
      <DeliveryMapModal
        visible={deliveryMapModalVisible}
        onClose={() => setDeliveryMapModalVisible(false)}
        onConfirmDelivery={() => {
          setDeliveryMapModalVisible(false);
          showToast('Delivery address saved to your profile!', 'success');
        }}
      />

      {/* Contact Us Modal: Customer Support No. & Branch Names with Branch Location (City Names) */}
      <Modal visible={contactModalVisible} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setContactModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.contactModalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.contactIconCircle}>
                  <PhoneCall size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Contact Us</Text>
                  <Text style={styles.contactModalSub}>Customer Support & Branch Locations</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setContactModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: 6, gap: 12 }}>
              {/* Recent Cancelled Order Warning */}
              {recentCancelledOrder && (() => {
                const attr = getCancellationAttribution(recentCancelledOrder);
                return (
                  <View
                    style={{
                      backgroundColor: '#FEF2F2',
                      borderWidth: 1,
                      borderColor: '#FCA5A5',
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={15} color="#DC2626" />
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#DC2626' }}>
                        Recent Order #{recentCancelledOrder.orderNumber}:{' '}
                        {attr.isCustomer
                          ? 'Cancelled by You'
                          : attr.badge === 'CANCELLED (BRANCH CLOSED)'
                            ? 'Cancelled (Branch Closed)'
                            : 'Cancelled by Staff'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#7F1D1D', marginTop: 4, lineHeight: 15 }}>
                      {attr.isCustomer
                        ? 'You cancelled this order. View your Order History for full receipt and details.'
                        : attr.badge === 'CANCELLED (BRANCH CLOSED)'
                          ? 'This order was cancelled because the branch went offline before receipt. For immediate refund assistance, please call customer support below.'
                          : 'This order was cancelled by cafe staff before receipt. For immediate refund assistance, please call customer support below.'}
                    </Text>
                  </View>
                );
              })()}

              {/* Customer Support Helpline Card */}
              <View style={styles.supportCard}>
                <Text style={styles.supportLabel}>CUSTOMER SUPPORT HELPLINE 📞</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <View>
                    <Text style={styles.supportPhone}>+92 42 3575 8899</Text>
                    <Text style={styles.supportHours}>UAN Helpline: +92 42 111-FOODIES</Text>
                    <Text style={styles.supportHours}>Daily: 11:00 AM – 1:00 AM</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callNowBtn}
                    onPress={() => Linking.openURL('tel:+924235758899').catch(() => {})}
                    activeOpacity={0.8}
                  >
                    <Phone size={13} color={Colors.textWhite} />
                    <Text style={styles.callNowBtnText}>Call Now</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.supportEmailText}>
                  Support Email: <Text style={{ fontWeight: '700', color: Colors.textMain }}>support@foodiescafe.pk</Text>
                </Text>
              </View>

              {/* Branch Names with Branch Location (City Names) */}
              <Text style={styles.branchSectionHeading}>OFFICIAL BRANCHES & LOCATIONS</Text>

              {/* Lahore */}
              <View style={styles.branchCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MapPin size={14} color={Colors.primary} />
                    <Text style={styles.branchTitle}>Gulberg Branch (Lahore)</Text>
                  </View>
                  <Text style={styles.branchAddress}>Mian Mehmood Ali Kasoori Road, Gulberg III, Lahore</Text>
                  <Text style={styles.branchPhone}>📞 +92 42 3575 8899</Text>
                </View>
                <TouchableOpacity
                  style={styles.branchCallBtn}
                  onPress={() => Linking.openURL('tel:+924235758899').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={styles.branchCallBtnText}>Call</Text>
                </TouchableOpacity>
              </View>

              {/* Islamabad */}
              <View style={styles.branchCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MapPin size={14} color={Colors.primary} />
                    <Text style={styles.branchTitle}>F-7 Branch (Islamabad)</Text>
                  </View>
                  <Text style={styles.branchAddress}>College Road, F-7 Markaz, Jinnah Super, Islamabad</Text>
                  <Text style={styles.branchPhone}>📞 +92 51 265 4433</Text>
                </View>
                <TouchableOpacity
                  style={styles.branchCallBtn}
                  onPress={() => Linking.openURL('tel:+92512654433').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={styles.branchCallBtnText}>Call</Text>
                </TouchableOpacity>
              </View>

              {/* Karachi */}
              <View style={styles.branchCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <MapPin size={14} color={Colors.primary} />
                    <Text style={styles.branchTitle}>Clifton Branch (Karachi)</Text>
                  </View>
                  <Text style={styles.branchAddress}>26th Street, Tauheed Commercial, Clifton Block 4, Karachi</Text>
                  <Text style={styles.branchPhone}>📞 +92 21 3583 2211</Text>
                </View>
                <TouchableOpacity
                  style={styles.branchCallBtn}
                  onPress={() => Linking.openURL('tel:+922135832211').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={styles.branchCallBtnText}>Call</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.primary,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  editPencilBtn: {
    padding: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 3,
  },
  infoPillsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  infoPillText: {
    fontSize: 11,
    color: Colors.textMain,
    fontWeight: '600',
  },
  guestCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 16,
  },
  guestAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  guestTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  guestSub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  signInPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  signInPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  addAddressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addAddressPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyAddressText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  profileAddressCard: {
    backgroundColor: Colors.bgMain,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  profileAddressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileAddressLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileAddressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  profileAddressLine: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  switchSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    paddingRight: 10,
  },
  staffAppSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginBottom: 16,
    gap: 12,
  },
  staffIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  staffAppSwitchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  staffAppSwitchSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  staffAppArrow: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '900',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 101, 40, 0.25)',
    marginBottom: 14,
    gap: 12,
  },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 101, 40, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 101, 40, 0.2)',
  },
  notificationCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  notificationCardSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  unreadBadgePill: {
    backgroundColor: Colors.primary,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgePillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: Colors.textWhite,
    letterSpacing: 0.5,
  },
  contactUsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 101, 40, 0.25)',
    marginBottom: 14,
    gap: 12,
  },
  contactIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 101, 40, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 101, 40, 0.2)',
  },
  contactCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  contactCardSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  contactModalBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 390,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  contactModalSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  contactIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(217, 101, 40, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCard: {
    backgroundColor: 'rgba(217, 101, 40, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(217, 101, 40, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  supportLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  supportPhone: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 2,
  },
  supportHours: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  callNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  callNowBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  supportEmailText: {
    fontSize: 11,
    color: Colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 101, 40, 0.18)',
    borderStyle: 'dashed',
    paddingTop: 6,
    marginTop: 8,
  },
  branchSectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  branchCard: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  branchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  branchAddress: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  branchPhone: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  branchCallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.primary,
    backgroundColor: Colors.bgCard,
  },
  branchCallBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#FCA5A5',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 10,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
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
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelModalBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  cancelModalText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  saveModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveModalText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});
