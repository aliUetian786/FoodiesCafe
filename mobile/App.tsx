import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import { Colors } from './src/theme/colors';
import { Header } from './src/components/Header';
import { Toast } from './src/components/Toast';
import { FlyingCartAnimation } from './src/components/FlyingCartAnimation';
import { RoleNavigator } from './src/navigation/RoleNavigator';
import { CustomerCart } from './src/customer/CustomerCart';
import { BranchItemUnavailableModal } from './src/components/BranchItemUnavailableModal';

export default function App() {
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [navigateHomeTrigger, setNavigateHomeTrigger] = useState(0);
  const [navigateTrackingTrigger, setNavigateTrackingTrigger] = useState(0);

  return (
    <AppProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Header
          onOpenCart={() => setCartModalVisible(true)}
          onNavigateHome={() => setNavigateHomeTrigger((t) => t + 1)}
        />
        <RoleNavigator
          onOpenCart={() => setCartModalVisible(true)}
          navigateHomeTrigger={navigateHomeTrigger}
          navigateTrackingTrigger={navigateTrackingTrigger}
          isCartOpen={cartModalVisible}
          onCloseCart={() => setCartModalVisible(false)}
        />
        <FlyingCartAnimation />
        <CustomerCart
          visible={cartModalVisible}
          onClose={() => setCartModalVisible(false)}
          onOrderPlaced={() => setNavigateTrackingTrigger((t) => t + 1)}
        />
        <BranchItemUnavailableModal />
        <Toast />
      </View>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgMain },
});
