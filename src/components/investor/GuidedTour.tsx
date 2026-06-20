import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, ChevronRight, ChevronLeft, Building2, Heart, FileText, 
  MessageSquare, Store, Bell, Gift, Sparkles, CheckCircle
} from 'lucide-react';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: string;
  action?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Investor Portal!',
    description: 'Let\'s take a quick tour of the features available to help you find and manage rental arbitrage investments.',
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
  },
  {
    id: 'deals',
    title: 'Active Deal Flow',
    description: 'Browse pre-vetted rental arbitrage opportunities. Each deal has been verified by our team and includes projected revenue, expenses, and ROI.',
    icon: <Building2 className="w-8 h-8 text-blue-600" />,
    highlight: 'dashboard',
    action: 'Click "Active Deal Flow" to explore available properties'
  },
  {
    id: 'saved',
    title: 'Save Your Favorites',
    description: 'Found a deal you like? Save it to your favorites for easy access later. You can compare multiple properties side by side.',
    icon: <Heart className="w-8 h-8 text-red-500" />,
    highlight: 'saved',
    action: 'Use the heart icon on any deal to save it'
  },
  {
    id: 'marketplace',
    title: 'Deal Marketplace',
    description: 'Buy existing arbitrage contracts from other investors or list your own operations for sale. A great way to acquire established businesses.',
    icon: <Store className="w-8 h-8 text-green-600" />,
    highlight: 'marketplace',
    action: 'Visit the Marketplace tab to browse listings'
  },
  {
    id: 'reports',
    title: 'Market Reports',
    description: 'Generate AI-powered market reports for any city. Get insights on regulations, competition, revenue potential, and more.',
    icon: <FileText className="w-8 h-8 text-purple-600" />,
    highlight: 'reports',
    action: 'Go to Reports to generate your first market analysis'
  },
  {
    id: 'penny',
    title: 'Meet Penny - Your AI Assistant',
    description: 'Have questions? Click the chat bubble in the bottom right corner to talk with Penny, our AI assistant who can help with market research and property analysis.',
    icon: <MessageSquare className="w-8 h-8 text-amber-600" />,
    action: 'Look for the chat bubble in the corner'
  },
  {
    id: 'notifications',
    title: 'Stay Updated',
    description: 'Set up deal alerts to get notified when new properties match your criteria. Never miss an opportunity!',
    icon: <Bell className="w-8 h-8 text-orange-500" />,
    highlight: 'deal-alerts',
    action: 'Configure your alerts in the Deal Alerts tab'
  },
  {
    id: 'referrals',
    title: 'Earn Rewards',
    description: 'Refer other investors and earn credits when they sign up. Share your unique referral link with friends and colleagues.',
    icon: <Gift className="w-8 h-8 text-pink-500" />,
    highlight: 'referrals',
    action: 'Check out the Referrals tab for your unique link'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You now know the basics of your investor portal. Start exploring deals and let us know if you have any questions!',
    icon: <CheckCircle className="w-8 h-8 text-green-500" />,
  }
];

interface Props {
  onComplete: () => void;
  onNavigate?: (tab: string) => void;
}

export function GuidedTour({ onComplete, onNavigate }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleHighlightClick = () => {
    if (step.highlight && onNavigate) {
      onNavigate(step.highlight);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        <CardContent className="pt-8 pb-6 px-6">
          {/* Step indicator */}
          <div className="flex justify-center gap-1.5 mb-6">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep 
                    ? 'bg-amber-500 w-6' 
                    : index < currentStep 
                      ? 'bg-amber-300' 
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center shadow-inner">
              {step.icon}
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h2>
            <p className="text-gray-600 leading-relaxed">{step.description}</p>
            
            {step.action && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium">
                  <span className="text-amber-600">Tip:</span> {step.action}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            {step.highlight && onNavigate && (
              <Button
                variant="ghost"
                onClick={handleHighlightClick}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                Go There
              </Button>
            )}

            <Button
              onClick={handleNext}
              className="flex-1 bg-[#d4a574] hover:bg-[#c49464]"
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>

          {/* Skip link */}
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Skip tour
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
