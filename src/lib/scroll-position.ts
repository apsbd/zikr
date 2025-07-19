// Scroll position management
class ScrollPositionManager {
  private positions = new Map<string, number>();
  
  savePosition(key: string, position: number) {
    this.positions.set(key, position);
    // Also save to sessionStorage for persistence during the session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`scroll-${key}`, position.toString());
    }
  }
  
  getPosition(key: string): number {
    // First check memory
    const memoryPosition = this.positions.get(key);
    if (memoryPosition !== undefined) return memoryPosition;
    
    // Then check sessionStorage
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`scroll-${key}`);
      if (stored) {
        const position = parseInt(stored, 10);
        this.positions.set(key, position);
        return position;
      }
    }
    
    return 0;
  }
  
  clearPosition(key: string) {
    this.positions.delete(key);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`scroll-${key}`);
    }
  }
}

export const scrollPosition = new ScrollPositionManager();