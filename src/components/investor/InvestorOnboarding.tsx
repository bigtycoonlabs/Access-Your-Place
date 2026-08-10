import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Building2, DollarSign, MapPin, Home, User, 
  CheckCircle, ArrowRight, ArrowLeft, Sparkles, Target
} from 'lucide-react';
import { logOnboardingCompleted } from '@/hooks/useActivityLog';

interface Props {
  investor: any;
  onComplete: (updated: any) => void;
}

const markets = [
  'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 
  'Phoenix, AZ', 'Denver, CO', 'Nashville, TN', 'Atlanta, GA', 
  'Tampa, FL', 'Orlando, FL', 'Miami, FL', 'Charlotte, NC',
  'Raleigh, NC', 'Jacksonville, FL', 'Las Vegas, NV', 'Seattle, WA',
  'Portland, OR', 'Salt Lake City, UT', 'Albuquerque, NM', 'Columbus, OH'
];

const opTypes = [
  { id: 'str', label: 'Short-Term Rentals (Airbnb/VRBO)', description: 'Nightly vacation rentals' },
  { id: 'coliving', label: 'Co-Living / Room Rentals', description: 'Rent by the room' },
  { id: 'mtr', label: 'Mid-Term Rentals (30+ days)', description: 'Monthly furnished rentals' }
];

const budgetRanges = [
  { min: 0, max: 5000, label: 'Under $5,000' },
  { min: 5000, max: 10000, label: '$5,000 - $10,000' },
  { min: 10000, max: 25000, label: '$10,000 - $25,000' },
  { min: 25000, max: 50000, label: '$25,000 - $50,000' },
  { min: 50000, max: 100000, label: '$50,000 - $100,000' },
  { min: 100000, max: 999999, label: '$100,000+' }
];

const experienceLevels = [
  { id: 'new', label: 'New to Rental Arbitrage', description: 'Just getting started' },
  { id: 'beginner', label: '1-2 Properties', description: 'Some experience' },
  { id: 'intermediate', label: '3-5 Properties', description: 'Growing portfolio' },
  { id: 'experienced', label: '6+ Properties', description: 'Experienced investor' }
];

export function InvestorOnboarding({ investor, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: investor.company_name || '',
    portfolio_count: investor.portfolio_count || 0,
    experience_level: '',
    investment_budget_min: '',
    investment_budget_max: '',
    preferred_markets: [] as string[],
    preferred_operation_types: [] as string[],
    investment_goals: '',
    timeline: ''
  });
  const { toast } = useToast();

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const toggleMarket = (m: string) => {
    setForm(f => ({ 
      ...f, 
      preferred_markets: f.preferred_markets.includes(m) 
        ? f.preferred_markets.filter(x => x !== m) 
        : [...f.preferred_markets, m] 
    }));
  };

  const toggleOp = (o: string) => {
    setForm(f => ({ 
      ...f, 
      preferred_operation_types: f.preferred_operation_types.includes(o) 
        ? f.preferred_operation_types.filter(x => x !== o) 
        : [...f.preferred_operation_types, o] 
    }));
  };

  const selectBudgetRange = (range: typeof budgetRanges[0]) => {
    setForm(f => ({
      ...f,
      investment_budget_min: String(range.min),
      investment_budget_max: String(range.max)
    }));
  };

  const selectExperience = (level: string, count: number) => {
    setForm(f => ({
      ...f,
      experience_level: level,
      portfolio_count: count
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    // Retry logic for network issues (up to 3 attempts)
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Onboarding] Attempt ${attempt} to save preferences...`);
        
        // FIXED: Added body wrapper - this was the bug causing "Failed to save preferences"
        const { data, error } = await supabase.functions.invoke('investor-login', {
          body: {
            action: 'update_profile',
            session_token: localStorage.getItem('investorSessionToken'), 
            company_name: form.company_name,
            portfolio_count: form.portfolio_count,
            investment_budget_min: Number(form.investment_budget_min) || null, 
            investment_budget_max: Number(form.investment_budget_max) || null, 
            preferred_markets: form.preferred_markets,
            preferred_operation_types: form.preferred_operation_types,
            onboarding_completed: true,
            show_guided_tour: true // Flag to show guided tour on first dashboard visit
          }
        });
        
        if (error) {
          console.error(`[Onboarding] Attempt ${attempt} error:`, error);
          lastError = error;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        
        if (data?.success) {
          // Log onboarding completed activity
          logOnboardingCompleted(investor.id);
          
          toast({ title: 'Profile Complete!', description: 'Welcome to the investor portal.' });
          onComplete({ ...data.investor, show_guided_tour: true });
          setLoading(false);
          return;
        } else if (data?.error) {
          console.error(`[Onboarding] Server error:`, data.error);
          lastError = new Error(data.error);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
      } catch (err: any) {
        console.error(`[Onboarding] Attempt ${attempt} exception:`, err);
        lastError = err;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    // All attempts failed
    const errorMessage = lastError?.message || 'Failed to save preferences';
    toast({ 
      title: 'Error', 
      description: errorMessage.includes('fetch') || errorMessage.includes('network') 
        ? 'Network error. Please check your connection and try again.' 
        : errorMessage, 
      variant: 'destructive' 
    });
    setLoading(false);
  };


  const canProceed = () => {
    switch (step) {
      case 1:
        return form.experience_level !== '';
      case 2:
        return form.investment_budget_min !== '' && form.investment_budget_max !== '';
      case 3:
        return form.preferred_markets.length > 0;
      case 4:
        return form.preferred_operation_types.length > 0;
      default:
        return true;
    }
  };

  const firstName = investor.full_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a365d] via-[#2d5a87] to-[#1a365d] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0">
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        <CardHeader className="text-center pt-8">
          <div className="flex justify-center mb-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              step === 1 ? 'bg-blue-100' :
              step === 2 ? 'bg-green-100' :
              step === 3 ? 'bg-purple-100' :
              'bg-amber-100'
            }`}>
              {step === 1 && <User className="w-8 h-8 text-blue-600" />}
              {step === 2 && <DollarSign className="w-8 h-8 text-green-600" />}
              {step === 3 && <MapPin className="w-8 h-8 text-purple-600" />}
              {step === 4 && <Target className="w-8 h-8 text-amber-600" />}
            </div>
          </div>
          
          <CardTitle className="text-2xl">
            {step === 1 && `Welcome, ${firstName}!`}
            {step === 2 && 'Investment Budget'}
            {step === 3 && 'Preferred Markets'}
            {step === 4 && 'Investment Strategy'}
          </CardTitle>
          
          <CardDescription className="text-base">
            {step === 1 && 'Tell us about your experience with rental arbitrage'}
            {step === 2 && 'What\'s your budget for acquiring new properties?'}
            {step === 3 && 'Select the markets you\'re interested in'}
            {step === 4 && 'What types of operations interest you?'}
          </CardDescription>

          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  s === step ? 'bg-[#d4a574] w-8' : s < step ? 'bg-[#d4a574]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {/* Step 1: Experience Level */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {experienceLevels.map((level, idx) => {
                  const counts = [0, 1, 4, 8];
                  const isSelected = form.experience_level === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => selectExperience(level.id, counts[idx])}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-[#d4a574] bg-amber-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${isSelected ? 'text-[#1a365d]' : 'text-gray-900'}`}>
                            {level.label}
                          </p>
                          <p className="text-sm text-gray-500">{level.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-[#d4a574]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <Label htmlFor="company">Company Name (Optional)</Label>
                <Input
                  id="company"
                  value={form.company_name}
                  onChange={e => setForm({...form, company_name: e.target.value})}
                  placeholder="Your company or LLC name"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Budget */}
          {step === 2 && (
            <div className="grid gap-3">
              {budgetRanges.map(range => {
                const isSelected = form.investment_budget_min === String(range.min) && 
                                   form.investment_budget_max === String(range.max);
                return (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => selectBudgetRange(range)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? 'border-[#d4a574] bg-amber-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${isSelected ? 'text-[#1a365d]' : 'text-gray-900'}`}>
                        {range.label}
                      </span>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-[#d4a574]" />
                      )}
                    </div>
                  </button>
                );
              })}
              <p className="text-sm text-gray-500 text-center mt-2">
                This helps us show you relevant deals within your budget
              </p>
            </div>
          )}

          {/* Step 3: Markets */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
                {markets.map(m => {
                  const isSelected = form.preferred_markets.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMarket(m)}
                      className={`p-3 rounded-lg border text-left text-sm transition-all ${
                        isSelected 
                          ? 'border-[#d4a574] bg-amber-50 text-[#1a365d]' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-[#d4a574] border-[#d4a574]' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className="font-medium">{m}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {form.preferred_markets.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">{form.preferred_markets.length}</span> market{form.preferred_markets.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Operation Types */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {opTypes.map(o => {
                  const isSelected = form.preferred_operation_types.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOp(o.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-[#d4a574] bg-amber-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${isSelected ? 'text-[#1a365d]' : 'text-gray-900'}`}>
                            {o.label}
                          </p>
                          <p className="text-sm text-gray-500">{o.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-[#d4a574] border-[#d4a574]' : 'border-gray-300'
                        }`}>
                          {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gradient-to-br from-[#1a365d] to-[#2d5a87] rounded-xl text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold">Your Investment Profile</span>
                </div>
                <div className="space-y-2 text-sm text-white/80">
                  <p>Budget: <span className="text-white font-medium">
                    ${Number(form.investment_budget_min).toLocaleString()} - ${Number(form.investment_budget_max).toLocaleString()}
                  </span></p>
                  <p>Markets: <span className="text-white font-medium">
                    {form.preferred_markets.length} selected
                  </span></p>
                  <p>Strategy: <span className="text-white font-medium">
                    {form.preferred_operation_types.map(t => 
                      t === 'str' ? 'STR' : t === 'coliving' ? 'Co-Living' : 'MTR'
                    ).join(', ') || 'None selected'}
                  </span></p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(s => s - 1)}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            {step < totalSteps ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 bg-[#d4a574] hover:bg-[#c49464]"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || !canProceed()}
                className="flex-1 bg-[#d4a574] hover:bg-[#c49464]"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Complete Setup
                <CheckCircle className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
