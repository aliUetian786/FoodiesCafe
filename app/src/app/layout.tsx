import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata: Metadata = {
  title: 'FoodiesCafe — Multi-Branch Cafe & Dining System',
  description: 'Eat Fresh & Healthy. Modern multi-branch cafe ordering, table QR codes, kitchen queues, and central cash reconciliation in Pakistan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
