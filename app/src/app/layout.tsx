import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StoreProvider } from '@/redux/StoreProvider';
import { AppProvider } from '@/context/AppContext';
import { KeyboardInputLift } from '@/components/common/KeyboardInputLift';

export const metadata: Metadata = {
  title: 'FoodiesCafe',
  description: 'Eat Fresh & Healthy. Modern cafe ordering, table QR codes, kitchen queues, and central cash reconciliation in Pakistan.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

// Phone keyboards shrink the page instead of covering it, so centred pop-ups (login, OTP, checkout)
// re-centre above the keyboard and the focused input stays visible.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>
        <StoreProvider>
          <AppProvider>
            <KeyboardInputLift />
            {children}
          </AppProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
