'use client';

import { useEffect } from 'react';

export default function NativeAppEnhancements() {
  useEffect(() => {
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    const preventZoom = (e: TouchEvent) => {
      const now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // Prevent pinch zoom
    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Prevent elastic scrolling (overscroll)
    const preventOverscroll = (e: TouchEvent) => {
      // Get the element being scrolled
      const target = e.target as Element;
      const scrollableElement = target.closest('[data-scrollable]') || 
                               target.closest('.overflow-auto') || 
                               target.closest('.overflow-y-auto') || 
                               target.closest('.overflow-scroll') ||
                               document.documentElement;

      if (scrollableElement) {
        const scrollTop = scrollableElement.scrollTop;
        const scrollHeight = scrollableElement.scrollHeight;
        const height = scrollableElement.clientHeight;
        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollTop + height >= scrollHeight;

        // Prevent overscroll at top and bottom
        if ((isAtTop && e.touches[0].clientY > e.touches[0].clientY) ||
            (isAtBottom && e.touches[0].clientY < e.touches[0].clientY)) {
          e.preventDefault();
        }
      }
    };

    // Prevent context menu on long press
    const preventContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // Add event listeners
    document.addEventListener('touchend', preventZoom, { passive: false });
    document.addEventListener('touchstart', preventPinchZoom, { passive: false });
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('touchmove', preventOverscroll, { passive: false });
    document.addEventListener('contextmenu', preventContextMenu, { passive: false });

    // Prevent zoom on specific gestures
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());

    // Cleanup
    return () => {
      document.removeEventListener('touchend', preventZoom);
      document.removeEventListener('touchstart', preventPinchZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
      document.removeEventListener('touchmove', preventOverscroll);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
      document.removeEventListener('gesturechange', (e) => e.preventDefault());
      document.removeEventListener('gestureend', (e) => e.preventDefault());
    };
  }, []);

  // This component doesn't render anything
  return null;
}