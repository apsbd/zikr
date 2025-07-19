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
    
    // Check if this is a new build (different build time)
    const isNewBuild = storedBuildTime && storedBuildTime !== this.BUILD_TIME;
    
    if (isNewBuild) {
      console.log(`📱 New build detected:`);
      console.log(`  Version: ${this.CURRENT_VERSION}`);
      console.log(`  Previous build: ${new Date(parseInt(storedBuildTime)).toISOString()}`);
      console.log(`  Current build: ${new Date(parseInt(this.BUILD_TIME)).toISOString()}`);
      
      // Store the new build time BEFORE clearing cache to prevent loops
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
      
      // Clear everything and reload
      await this.clearAppCache();
      
      // Force reload to get new content
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } else if (!storedBuildTime) {
      // First time loading, just store the values without reloading
      console.log('📱 First time app load, storing build info');
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
    }
    // If build time matches, do nothing (prevents infinite loops)
  }

  private async clearAppCache() {
    console.log('🔄 Clearing app cache and service workers...');
    
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => {
            console.log('Unregistering service worker:', registration.scope);
            return registration.unregister();
          })
        );
      }
      
      // 2. Clear ALL caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }
      
      // 3. Clear localStorage data (keep only essential user data)
      const keysToKeep = [
        'supabase.auth.token',
        'theme',
        'pwa-install-dismissed'
      ];
      
      const savedData: Record<string, string> = {};
      keysToKeep.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) savedData[key] = value;
      });
      
      // Clear all localStorage
      localStorage.clear();
      
      // Restore essential data
      Object.entries(savedData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // 4. Clear sessionStorage
      sessionStorage.clear();
      
      console.log('✅ Cache and service workers cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
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
    console.log('🔄 Forcing app update...');
    
    // Always clear cache when forcing update
    await this.clearAppCache();
    
    // If there's a waiting service worker, tell it to skip waiting
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Force reload to get new content
    // Use a small delay to ensure cache clearing completes
    setTimeout(() => {
      window.location.reload();
    }, 100);
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