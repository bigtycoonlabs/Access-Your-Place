import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User, Shield } from 'lucide-react';
import AypLogo from './AypLogo';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Available Deals', href: '/deals' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Core Values', href: '/core-values' },
    { label: 'Landlord Partners', href: '/landlord-partnership' },
    { label: 'Careers', href: '/careers' },
  ];

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (isOpen && mobileMenuRef.current) {
      const focusableElements = mobileMenuRef.current.querySelectorAll(
        'a[href], button, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      firstElement?.focus();
      
      return () => document.removeEventListener('keydown', handleTabKey);
    }
  }, [isOpen]);

  const handleMenuToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    navigate(href);
  };

  return (
    <header className="bg-[#0a0f1a] text-white sticky top-0 z-50 shadow-lg border-b border-white/10" role="banner">
      {/* Skip Links - WCAG 2.1 Level A: Bypass Blocks (2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to main content
      </a>
      <a 
        href="#main-navigation" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-52 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-[#1a365d] focus:ring-2 focus:ring-[#d4a574] focus:outline-none focus:font-medium"
      >
        Skip to navigation
      </a>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a] rounded-lg px-2 py-1"
            aria-label="Access Your Place - Go to homepage"
          >
            <AypLogo />
          </Link>
          
          {/* Desktop Navigation */}
          <nav 
            id="main-navigation"
            className="hidden lg:flex items-center space-x-5" 
            role="navigation" 
            aria-label="Main navigation"
          >
            {navItems.map((item) => (
              <Link 
                key={item.label} 
                to={item.href} 
                className="hover:text-[#d4a574] transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a] rounded px-2 py-1"
              >
                {item.label}
              </Link>
            ))}
            <Link 
              to="/investor/login" 
              className="flex items-center gap-1 hover:text-[#d4a574] transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a] rounded px-2 py-1"
              aria-label="Investor Portal Login"
            >
              <User size={14} aria-hidden="true" />
              Portal
            </Link>
            <Link 
              to="/staff/login" 
              className="hover:text-[#d4a574] transition-colors text-xs opacity-70 focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 focus:ring-offset-[#0a0f1a] rounded px-2 py-1"
              aria-label="Staff Login"
            >
              Staff
            </Link>
            <Link 
              to="/investor/login" 
              className="bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-5 py-2 rounded-lg font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0a0f1a]"
              aria-label="Start your evaluation"
            >
              Start Evaluation
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            ref={menuButtonRef}
            onClick={handleMenuToggle} 
            className="lg:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isOpen ? (
              <X size={24} aria-hidden="true" />
            ) : (
              <Menu size={24} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav 
            ref={mobileMenuRef}
            id="mobile-menu" 
            className="lg:hidden pb-4 space-y-3" 
            role="navigation" 
            aria-label="Mobile navigation"
          >
            {navItems.map((item) => (
              <button 
                key={item.label} 
                onClick={() => handleNavClick(item.href)}
                className="block w-full text-left hover:text-[#d4a574] transition-colors py-2 px-2 focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
              >
                {item.label}
              </button>
            ))}
            <button 
              onClick={() => handleNavClick('/investor/login')}
              className="block w-full text-left hover:text-[#d4a574] transition-colors py-2 px-2 focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
            >
              Investor Portal
            </button>
            <button 
              onClick={() => handleNavClick('/staff/login')}
              className="block w-full text-left hover:text-[#d4a574] transition-colors text-sm opacity-70 py-2 px-2 focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded"
            >
              Staff Login
            </button>
            <button 
              onClick={() => handleNavClick('/investor/login')}
              className="block w-full bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-6 py-3 rounded-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Start your evaluation"
            >
              Start Evaluation
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
