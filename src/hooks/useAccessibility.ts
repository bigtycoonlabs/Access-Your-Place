import { useCallback, useEffect, useRef } from 'react';
import React from 'react';

/**
 * Accessibility utility hook providing helpers for:
 * - Screen reader announcements
 * - Focus management
 * - Keyboard navigation
 * - Live region updates
 */
export function useAccessibility() {
  const announcementRef = useRef<HTMLDivElement | null>(null);

  // Create a live region for announcements if it doesn't exist
  useEffect(() => {
    if (!document.getElementById('sr-announcements')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'sr-announcements';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
      announcementRef.current = liveRegion;
    } else {
      announcementRef.current = document.getElementById('sr-announcements') as HTMLDivElement;
    }
  }, []);

  /**
   * Announce a message to screen readers via live region
   */
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcementRef.current) {
      announcementRef.current.setAttribute('aria-live', priority);
      announcementRef.current.textContent = '';
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = message;
        }
      }, 100);
    }
  }, []);

  /**
   * Focus an element by ID with optional announcement
   */
  const focusElement = useCallback((elementId: string, announcement?: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
      if (announcement) {
        announce(announcement);
      }
    }
  }, [announce]);

  /**
   * Focus the main content area (for skip links)
   */
  const focusMainContent = useCallback(() => {
    const main = document.getElementById('main-content') || document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      announce('Skipped to main content');
    }
  }, [announce]);

  return {
    announce,
    focusElement,
    focusMainContent,
  };
}

/**
 * Skip Links Component - Provides keyboard users quick navigation
 * WCAG 2.1 Level A: Bypass Blocks (2.4.1)
 * Visually hidden by default, becomes visible on keyboard focus
 */
export function SkipLinks(): React.ReactElement {
  const handleSkipToMain = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const main = document.getElementById('main-content') || document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
    }
  };

  const handleSkipToNav = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const nav = document.querySelector('[role="navigation"]') || document.querySelector('nav');
    if (nav) {
      (nav as HTMLElement).setAttribute('tabindex', '-1');
      (nav as HTMLElement).focus();
    }
  };

  // Using the standardized skip link styling:
  // sr-only by default, visible on focus with white bg, navy text, gold ring
  const skipLinkClass = [
    'sr-only',
    'focus:not-sr-only',
    'focus:absolute',
    'focus:top-4',
    'focus:left-4',
    'focus:z-50',
    'focus:bg-white',
    'focus:px-4',
    'focus:py-2',
    'focus:rounded-md',
    'focus:shadow-lg',
    'focus:text-[#1a365d]',
    'focus:ring-2',
    'focus:ring-[#d4a574]',
    'focus:outline-none',
    'focus:font-medium',
  ].join(' ');

  return React.createElement('div', { className: 'contents' },
    React.createElement('a', {
      href: '#main-content',
      onClick: handleSkipToMain,
      onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && handleSkipToMain(e),
      className: skipLinkClass,
    }, 'Skip to main content'),
    React.createElement('a', {
      href: '#navigation',
      onClick: handleSkipToNav,
      onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && handleSkipToNav(e),
      className: [
        'sr-only',
        'focus:not-sr-only',
        'focus:absolute',
        'focus:top-4',
        'focus:left-52',
        'focus:z-50',
        'focus:bg-white',
        'focus:px-4',
        'focus:py-2',
        'focus:rounded-md',
        'focus:shadow-lg',
        'focus:text-[#1a365d]',
        'focus:ring-2',
        'focus:ring-[#d4a574]',
        'focus:outline-none',
        'focus:font-medium',
      ].join(' '),
    }, 'Skip to navigation')
  );
}


/**
 * Live Region Component - Announces messages to screen readers
 */
export function LiveRegion({ message }: { message: string }): React.ReactElement | null {
  const prevMessageRef = useRef<string>('');
  
  useEffect(() => {
    if (message && message !== prevMessageRef.current) {
      prevMessageRef.current = message;
    }
  }, [message]);

  if (!message) return null;

  return React.createElement('div', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    className: 'sr-only'
  }, message);
}

/**
 * Screen Reader Only Component - Visually hidden but accessible
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }): React.ReactElement {
  return React.createElement('span', { className: 'sr-only' }, children);
}

export default useAccessibility;
