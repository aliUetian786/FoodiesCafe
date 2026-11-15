import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Role, User } from '@/types/cafe';

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export interface UIState {
  theme: 'light';
  currentRole: Role;
  currentUser: User;
  toasts: ToastItem[];
  menuSearchQuery: string;
}

const GUEST_CUSTOMER: User = {
  id: 'user-guest',
  name: 'Guest Customer',
  phone: '',
  email: '',
  role: 'customer',
  status: 'active',
};

const getInitialRole = (): Role => {
  if (typeof window === 'undefined') return 'customer';
  const isStaff = window.location.pathname.startsWith('/staff');
  if (isStaff) {
    const savedRole = localStorage.getItem('foodies_staff_role');
    const savedLoginTime = localStorage.getItem('foodies_staff_login_time');
    const STAFF_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
    if (savedRole && savedLoginTime && Date.now() - Number(savedLoginTime) < STAFF_SESSION_MAX_AGE_MS) {
      return savedRole as Role;
    }
    return 'branch_manager';
  }
  return 'customer';
};

const getInitialUser = (): User => {
  if (typeof window === 'undefined') return GUEST_CUSTOMER;
  const isStaff = window.location.pathname.startsWith('/staff');
  if (isStaff) {
    const savedRole = localStorage.getItem('foodies_staff_role');
    const savedLoginTime = localStorage.getItem('foodies_staff_login_time');
    const STAFF_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
    if (savedRole && savedLoginTime && Date.now() - Number(savedLoginTime) < STAFF_SESSION_MAX_AGE_MS) {
      try {
        const savedUserStr = localStorage.getItem('foodies_staff_user');
        if (savedUserStr) {
          const parsed = JSON.parse(savedUserStr);
          if (parsed?.role === savedRole) return parsed;
        }
      } catch (e) {}
    }
    return {
      id: 'user-bm',
      name: 'Rashid Mehmood',
      phone: '+92 300 2223344',
      email: 'manager.gulberg@foodiescafe.pk',
      role: 'branch_manager',
      branchId: 'gulberg-lahore',
      status: 'active',
      password: 'password123',
      pin: '1234',
    };
  } else {
    try {
      const savedCust = localStorage.getItem('foodies_customer_user');
      const loginTimeStr = localStorage.getItem('foodies_customer_login_time');
      if (savedCust) {
        const parsed = JSON.parse(savedCust);
        if (parsed?.role === 'customer' && parsed.name && parsed.name !== 'Guest Customer') {
          const loginTime = loginTimeStr ? Number(loginTimeStr) : null;
          if (loginTime && !isNaN(loginTime) && Date.now() - loginTime > 24 * 60 * 60 * 1000) {
            return GUEST_CUSTOMER;
          }
          return parsed;
        }
      }
    } catch (e) {}
  }
  return GUEST_CUSTOMER;
};

const initialState: UIState = {
  theme: 'light',
  currentRole: getInitialRole(),
  currentUser: getInitialUser(),
  toasts: [],
  menuSearchQuery: '',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentRole: (state, action: PayloadAction<Role>) => {
      state.currentRole = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload !== 'customer') {
          localStorage.setItem('foodies_staff_role', action.payload);
          localStorage.setItem('foodies_staff_login_time', Date.now().toString());
        }
      }
    },
    setCurrentUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload.role === 'customer') {
          if (action.payload.name && action.payload.name !== 'Guest Customer') {
            localStorage.setItem('foodies_customer_user', JSON.stringify(action.payload));
            if (!localStorage.getItem('foodies_customer_login_time')) {
              localStorage.setItem('foodies_customer_login_time', Date.now().toString());
            }
          }
        } else {
          localStorage.setItem('foodies_staff_user', JSON.stringify(action.payload));
        }
      }
    },
    addToast: (state, action: PayloadAction<Omit<ToastItem, 'id'>>) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      state.toasts.push({ ...action.payload, id });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    setMenuSearchQuery: (state, action: PayloadAction<string>) => {
      state.menuSearchQuery = action.payload;
    },
  },
});

export const { setCurrentRole, setCurrentUser, addToast, removeToast, setMenuSearchQuery } = uiSlice.actions;

// Selectors
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectCurrentRole = (state: { ui: UIState }) => state.ui.currentRole;
export const selectCurrentUser = (state: { ui: UIState }) => state.ui.currentUser;
export const selectToasts = (state: { ui: UIState }) => state.ui.toasts;
export const selectMenuSearchQuery = (state: { ui: UIState }) => state.ui.menuSearchQuery;

export default uiSlice.reducer;

