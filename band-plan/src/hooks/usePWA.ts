import { useState, useEffect } from 'react';
import { pwaService } from '../services/pwaService';

export interface PWAState {
  canInstall: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  cacheSize: number;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    canInstall: pwaService.canInstall(),
    isInstalled: pwaService.isAppInstalled(),
    isOnline: pwaService.isOnline(),
    cacheSize: 0
  });

  useEffect(() => {
    // Listen for install availability changes
    const unsubscribeInstall = pwaService.onInstallAvailable((canInstall) => {
      setState(prev => ({ ...prev, canInstall }));
    });

    // Listen for online status changes
    const unsubscribeOnline = pwaService.onOnlineStatusChange((isOnline) => {
      setState(prev => ({ ...prev, isOnline }));
    });

    // Get initial cache size
    pwaService.getCacheSize().then(size => {
      setState(prev => ({ ...prev, cacheSize: size }));
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeInstall();
      unsubscribeOnline();
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    const success = await pwaService.installApp();
    if (success) {
      setState(prev => ({ 
        ...prev, 
        canInstall: false, 
        isInstalled: true 
      }));
    }
    return success;
  };

  const clearCache = async (): Promise<void> => {
    await pwaService.clearCache();
    setState(prev => ({ ...prev, cacheSize: 0 }));
  };

  const refreshCacheSize = async (): Promise<void> => {
    const size = await pwaService.getCacheSize();
    setState(prev => ({ ...prev, cacheSize: size }));
  };

  return {
    ...state,
    installApp,
    clearCache,
    refreshCacheSize
  };
}