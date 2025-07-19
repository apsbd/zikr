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
    
    console.log('🚀 Initializing app updater...');
    console.log('  Current version:', this.CURRENT_VERSION);
    console.log('  Current build:', new Date(parseInt(this.BUILD_TIME)).toISOString());
    
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
      
      // Just update the stored version info
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
      
      // Notify that an update is available
      this.handleUpdateAvailable();
    } else if (!storedBuildTime) {
      // First time loading, just store the values
      console.log('📱 First time app load, storing build info');
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      localStorage.setItem(this.BUILD_TIME_KEY, this.BUILD_TIME);
    } else {
      // Build time matches - no update needed
      console.log('✅ App is up to date');
    }
  }

  private async clearAppCache() {
    console.log('🔄 Clearing app cache...');
    
    try {
      // 1. Update service worker (don't unregister - just update)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        // Force update check for all service workers
        await Promise.all(
          registrations.map(registration => {
            console.log('Updating service worker:', registration.scope);
            return registration.update();
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
      
      // 3. Clear localStorage data (keep auth and essential user data)
      const keysToKeep = [
        'supabase.auth.token',
        'sb-',  // Keep all Supabase auth keys (they start with sb-)
        'theme',
        'pwa-install-dismissed',
        'app-version',  // Keep version info
        'app-build-time'  // Keep build time info
      ];
      
      const savedData: Record<string, string> = {};
      
      // Save all keys that should be kept
      Object.keys(localStorage).forEach(key => {
        // Check if key should be kept
        const shouldKeep = keysToKeep.some(keepKey => {
          if (keepKey.endsWith('-')) {
            // Prefix match (like 'sb-')
            return key.startsWith(keepKey);
          }
          return key === keepKey;
        });
        
        if (shouldKeep) {
          const value = localStorage.getItem(key);
          if (value) savedData[key] = value;
        }
      });
      
      // Clear all localStorage
      localStorage.clear();
      
      // Restore saved data
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
    
    // Update service worker if available
    if (this.registration) {
      await this.registration.update();
      
      // If there's a waiting service worker, tell it to skip waiting
      if (this.registration.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    
    // Just reload to get new content
    window.location.reload();
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