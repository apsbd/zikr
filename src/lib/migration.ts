// Migration utilities to handle old data formats

export function cleanupOldLocalStorageData(): void {
  try {
    // Remove old deck data that might be in localStorage
    localStorage.removeItem('zikr-decks');
    
    // Clean up old card progress with non-UUID keys
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('card-progress-card-')) {
        // Remove old format: card-progress-card-1, card-progress-card-timestamp, etc.
        localStorage.removeItem(key);
      }
    });
    
    console.log('Cleaned up old localStorage data');
  } catch (error) {
    console.error('Error cleaning up localStorage:', error);
  }
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}