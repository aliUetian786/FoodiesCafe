'use client';

import React from 'react';
import { HistoricalLoadingModal } from './HistoricalLoadingModal';

interface HistoricalLoadingBannerProps {
  message?: string;
  subMessage?: string;
  compact?: boolean;
}

export const HistoricalLoadingBanner: React.FC<HistoricalLoadingBannerProps> = () => {
  return <HistoricalLoadingModal visible={true} />;
};
