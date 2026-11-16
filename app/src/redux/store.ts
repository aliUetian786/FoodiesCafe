// Must stay the first import: purges stale cached data before anything reads localStorage.
import '@/lib/storageVersion';
import { configureStore } from '@reduxjs/toolkit';
import ordersReducer from './slices/ordersSlice';
import cartReducer from './slices/cartSlice';
import cafeReducer from './slices/cafeSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    orders: ordersReducer,
    cart: cartReducer,
    cafe: cafeReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // High speed, non-blocking state mutations
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

