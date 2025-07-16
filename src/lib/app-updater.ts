// App Update Management
class AppUpdater {
  private readonly VERSION_KEY = 'app-version';
  private readonly BUILD_TIME_KEY = 'app-build-time';
  
  // Update this in your build process or manually on each deployment
  private readonly CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  private readonly BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || Date.now().toString();
  
  private updateAvailable = false;
  private registration: ServiceWorkerRegistration | null = null;

  async initialize() {
    if (typeof window === 'undefined') return;
    
    // Check for app version updates
    await this.checkAppVersion();
    
    // Register service worker and check for updates
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.registration = registration;
        
        // Check for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.handleUpdateAvailable();
              }
            });
          }
        });
        
        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Reload the page to get new content
          window.location.reload();
        });
        
      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
      }
    }
  }

  private async checkAppVersion() {
    const storedVersion = localStorage.getItem(this.VERSION_KEY);
    const storedBuildTime = localStorage.getItem(this.BUILD_TIME_KEY);
    
    // Only check version, not build time, to avoid infinite reloads
    if (storedVersion && storedVersion !== this.CURRENT_VERSION) {
      console.log('App version updated, clearing caches...');
      await this.clearAppCache();
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
      
      // Force reload to get new content
      window.location.reload();
    } else if (!storedVersion) {
      // First time loading, just store the version without reloading
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
    } else {
      // Same version, just update build time silently
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
    }
  }

  private async clearAppCache() {
    // Clear localStorage data (keep user data, clear app cache)
    const keysToKeep = ['app-data-', 'supabase.auth.token']; // Keep user data
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      const shouldKeep = keysToKeep.some(prefix => key.startsWith(prefix));
      if (!shouldKeep) {
        localStorage.removeItem(key);
      }
    });

    // Clear service worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          // Keep user data caches, clear app caches
          if (!cacheName.includes('user-data')) {
            return caches.delete(cacheName);
          }
        })
      );
    }
  }

  private handleUpdateAvailable() {
    this.updateAvailable = true;
    
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('app-update-available', {
      detail: { version: this.CURRENT_VERSION }
    }));
  }

  async forceUpdate() {
    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Manual reload
      await this.clearAppCache();
      window.location.reload();
    }
  }

  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      currentVersion: this.CURRENT_VERSION,
      buildTime: this.BUILD_TIME
    };
  }
}

export const appUpdater = new AppUpdater();