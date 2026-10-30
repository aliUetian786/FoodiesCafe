'use client';

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { initSyncEngine } from './sync/syncEngine';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const cleanup = initSyncEngine();
    return () => {
      cleanup();
    };
  }, []);

  return <Provider store={store}>{children}</Provider>;
};

export default StoreProvider;

