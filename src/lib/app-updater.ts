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
    console.log('  Current build:', new Date(parseInt(this.BUILD_TIME)).toISOString());
    
    // Register service worker and check for updates
    if ('serviceWorker' in navigator) {
      try {
        // Check if service worker is already registered by next-pwa
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length > 0) {
          this.registration = registrations[0];
          console.log('Using existing service worker registration');
        } else {
          // This shouldn't happen with next-pwa, but just in case
          const registration = await navigator.serviceWorker.register('/sw.js');
          this.registration = registration;
        }
        
        // Check for updates immediately
        if (this.registration) {
          this.registration.update();
        }
        
        // Listen for update found
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration?.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                console.log('🔄 New service worker installed, update available');
                this.handleUpdateAvailable();
              }
            });
          }
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'NEW_VERSION_AVAILABLE') {
            this.handleUpdateAvailable();
          }
        });
        
        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // New service worker has taken control, reload the page
          console.log('🔄 New service worker activated, reloading page');
          window.location.reload();
        });
        
      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
      }
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
    
    // If there's a waiting service worker, tell it to skip waiting
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // The page will reload when the new service worker takes control
      // This is handled by the controllerchange event listener
    } else {
      // If no waiting worker, just reload to get latest
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