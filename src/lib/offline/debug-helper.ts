// Debug helper to inspect IndexedDB contents
export async function inspectIndexedDB() {
  const dbName = 'zikr-app-offline';
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const stores = ['decks', 'cards', 'user_progress', 'metadata'];
  const results: Record<string, any> = {};

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const data = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    results[storeName] = {
      count: data.length,
      data: data
    };
    
    console.log(`Store: ${storeName}`, {
      count: data.length,
      sample: data.slice(0, 3)
    });
    
    // Show deck IDs specifically
    if (storeName === 'decks') {
      console.log('Deck IDs:', data.map(d => d.id));
    }
  }

  db.close();
  return results;
}

// Test function to check Supabase directly
async function testSupabaseCards() {
  try {
    const { supabase } = await import('@/lib/supabase');
    
    console.log('Testing Supabase cards query...');
    
    // Get all cards
    const { data: allCards, error: allError } = await supabase
      .from('cards')
      .select('*');
      
    console.log('All cards:', allCards?.length || 0, allError);
    
    // Get all decks
    const { data: allDecks, error: deckError } = await supabase
      .from('decks')
      .select('*');
      
    console.log('All decks:', allDecks?.length || 0, deckError);
    
    // Check cards for specific deck
    const targetDeckId = '9d72956b-3197-4ed9-9a40-bd0a52ddfc30';
    const deckCards = allCards?.filter(card => card.deck_id === targetDeckId) || [];
    console.log(`Cards for deck ${targetDeckId}:`, deckCards.length);
    
    if (deckCards.length > 0) {
      console.log('Sample cards for this deck:', deckCards.slice(0, 3));
    }
    
    return { allCards, allDecks, deckCards };
  } catch (error) {
    console.error('Error testing Supabase:', error);
    return { error };
  }
}

// Simple sync function that runs immediately
function checkSupabaseCards() {
  testSupabaseCards().then(result => {
    console.log('✅ Supabase test completed:', result);
  }).catch(error => {
    console.error('❌ Supabase test failed:', error);
  });
}

// Force a full sync manually
async function forceFullSync() {
  try {
    const { offlineService } = await import('@/lib/offline');
    const { useAuth } = await import('@/contexts/auth');
    
    // Get current user from auth context
    const userString = localStorage.getItem('sb-syxzcntxlmasiribbexs-auth-token');
    if (!userString) {
      console.error('No user token found');
      return;
    }
    
    const authData = JSON.parse(userString);
    const userId = authData.user?.id;
    
    if (!userId) {
      console.error('No user ID found');
      return;
    }
    
    console.log('🔄 Forcing full sync for user:', userId);
    
    // Force sync by calling the sync engine directly
    const { SyncEngine } = await import('@/lib/offline');
    const syncEngine = SyncEngine.getInstance();
    
    const result = await syncEngine.performFullSync(userId);
    console.log('✅ Forced sync completed:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Force sync failed:', error);
    return { error };
  }
}

// Clear IndexedDB for testing
async function clearIndexedDB() {
  try {
    const dbName = 'zikr-app-offline';
    console.log('🗑️ Clearing IndexedDB...');
    
    const deleteRequest = indexedDB.deleteDatabase(dbName);
    
    return new Promise((resolve, reject) => {
      deleteRequest.onsuccess = () => {
        console.log('✅ IndexedDB cleared successfully');
        resolve(true);
      };
      deleteRequest.onerror = () => {
        console.error('❌ Failed to clear IndexedDB');
        reject(deleteRequest.error);
      };
    });
  } catch (error) {
    console.error('❌ Error clearing IndexedDB:', error);
    return false;
  }
}

// Add to window for easy debugging
if (typeof window !== 'undefined') {
  (window as any).inspectDB = inspectIndexedDB;
  (window as any).testSupabaseCards = testSupabaseCards;
  (window as any).checkSupabaseCards = checkSupabaseCards;
  (window as any).forceFullSync = forceFullSync;
  (window as any).clearIndexedDB = clearIndexedDB;
}