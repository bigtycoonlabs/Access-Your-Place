import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DevelopmentBanner() {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (dismissed) return null;

  return (
    <div 
      className="bg-gradient-to-r from-[#1a365d] to-[#2d4a7c] text-white py-2.5 px-4 relative"
      role="banner"
      aria-label="Platform launch announcement"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm">
        <Sparkles className="w-4 h-4 flex-shrink-0 text-[#d4a574]" aria-hidden="true" />
        <span>
          <strong className="text-[#d4a574]">Platform Launch!</strong>{' '}
          Access Your Place is now live with full marketplace features.{' '}
          <button 
            onClick={() => navigate('/blog/platform-launch-2026')}
            className="underline font-semibold hover:text-[#d4a574] inline-flex items-center gap-1 transition-colors"
            aria-label="Read about our platform launch and new features"
          >
            Discover what's new <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </span>
        <button 
          onClick={() => setDismissed(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-1 transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
