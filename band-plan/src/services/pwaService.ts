interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export class PWAService {
  private static instance: PWAService;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private installCallbacks: ((canInstall: boolean) => void)[] = [];

  private constructor() {
    this.init();
  }

  public static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  private init() {
    // Check if already installed
    this.checkInstallStatus();
    
    // Listen for beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notifyInstallCallbacks(true);
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notifyInstallCallbacks(false);
    });

    // Register service worker
    this.registerServiceWorker();
  }

  private checkInstallStatus() {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      console.log('PWA: App is running as PWA');
      this.isInstalled = true;
    }

    // Check if service worker is registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 0) {
          console.log('PWA: Service worker already registered');
        }
      });
    }
  }

  private async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('PWA: Service workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('PWA: Service worker registered successfully', registration.scope);

      // Listen for service worker updates
      registration.addEventListener('updatefound', () => {
        console.log('PWA: New service worker available');
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('PWA: New service worker installed, refresh available');
              this.showUpdateAvailableNotification();
            }
          });
        }
      });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('PWA: Service worker controller changed, reloading');
        window.location.reload();
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('PWA: Message from service worker:', event.data);
        
        if (event.data?.type === 'BACK_ONLINE') {
          this.showBackOnlineNotification();
        }
      });

    } catch (error) {
      console.error('PWA: Service worker registration failed:', error);
    }
  }

  public async installApp(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.log('PWA: No deferred prompt available');
      return false;
    }

    try {
      console.log('PWA: Showing install prompt');
      this.deferredPrompt.prompt();
      
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('PWA: Install prompt result:', outcome);
      
      if (outcome === 'accepted') {
        this.deferredPrompt = null;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PWA: Error during installation:', error);
      return false;
    }
  }

  public canInstall(): boolean {
    return !this.isInstalled && this.deferredPrompt !== null;
  }

  public isAppInstalled(): boolean {
    return this.isInstalled;
  }

  public onInstallAvailable(callback: (canInstall: boolean) => void): () => void {
    this.installCallbacks.push(callback);
    
    // Call immediately with current state
    callback(this.canInstall());
    
    // Return unsubscribe function
    return () => {
      const index = this.installCallbacks.indexOf(callback);
      if (index > -1) {
        this.installCallbacks.splice(index, 1);
      }
    };
  }

  private notifyInstallCallbacks(canInstall: boolean) {
    this.installCallbacks.forEach(callback => callback(canInstall));
  }

  private showUpdateAvailableNotification() {
    // This would integrate with your notification service
    if (window.confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
      this.skipWaiting();
    }
  }

  private showBackOnlineNotification() {
    console.log('PWA: Back online notification');
    // You could show a toast here
  }

  private async skipWaiting() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Utility methods for offline detection
  public isOnline(): boolean {
    return navigator.onLine;
  }

  public onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    // Call immediately with current status
    callback(navigator.onLine);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }

  // Cache management
  public async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('PWA: All caches cleared');
    }
  }

  public async getCacheSize(): Promise<number> {
    if (!('caches' in window) || !('storage' in navigator) || !('estimate' in navigator.storage)) {
      return 0;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      console.error('PWA: Error getting cache size:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const pwaService = PWAService.getInstance();