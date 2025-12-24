// PWA Utility Functions

/**
 * Check if the app is installable
 */
export const isPWAInstallable = () => {
  // Check if running as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return false; // Already installed
  }
  
  // Check if browser supports PWA installation
  return 'serviceWorker' in navigator && 'BeforeInstallPromptEvent' in window;
};

/**
 * Check if service worker is registered and active
 */
export const checkServiceWorkerStatus = async () => {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, registered: false, active: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const active = navigator.serviceWorker.controller !== null;
    
    return {
      supported: true,
      registered: !!registration,
      active,
      registration
    };
  } catch (error) {
    console.error('Error checking service worker status:', error);
    return { supported: true, registered: false, active: false, error };
  }
};

/**
 * Unregister all service workers (useful for debugging)
 */
export const unregisterServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  }
};

