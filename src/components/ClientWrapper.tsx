'use client';

import { useEffect, useState } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Initialize app updater
    const initAppUpdater = async () => {
      try {
        const { appUpdater } = await import('@/lib/app-updater');
        await appUpdater.initialize();
      } catch (error) {
        console.error('Failed to initialize app updater:', error);
      }
    };
    
    initAppUpdater();
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}