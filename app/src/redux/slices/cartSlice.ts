import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { OrderItem } from '@/types/cafe';

export interface CartState {
  items: OrderItem[];
}

const getInitialCart = (): OrderItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('foodies_cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

const initialState: CartState = {
  items: getInitialCart(),
};

const persistCart = (items: OrderItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('foodies_cart', JSON.stringify(items));
  } catch (e) {}
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCart: (state, action: PayloadAction<OrderItem[]>) => {
      state.items = action.payload;
      persistCart(state.items);
    },
    addToCart: (state, action: PayloadAction<OrderItem>) => {
      const newItem = action.payload;
      const existingIdx = state.items.findIndex(
        (i) =>
          i.menuItemId === newItem.menuItemId &&
          i.size === newItem.size &&
          JSON.stringify(i.extras || []) === JSON.stringify(newItem.extras || []) &&
          i.instructions === newItem.instructions
      );

      if (existingIdx >= 0) {
        state.items[existingIdx].quantity += newItem.quantity;
      } else {
        state.items.push(newItem);
      }
      persistCart(state.items);
    },
    updateCartItemQty: (state, action: PayloadAction<{ itemId: string; delta: number }>) => {
      const { itemId, delta } = action.payload;
      const idx = state.items.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        const newQty = state.items[idx].quantity + delta;
        if (newQty <= 0) {
          state.items.splice(idx, 1);
        } else {
          state.items[idx].quantity = newQty;
        }
      }
      persistCart(state.items);
    },
    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      persistCart(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      persistCart([]);
    },
  },
});

export const { setCart, addToCart, updateCartItemQty, removeFromCart, clearCart } = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartCount = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, i) => sum + (i.quantity || 1), 0)
);
export const selectCartSubtotal = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0)
);

export default cartSlice.reducer;
