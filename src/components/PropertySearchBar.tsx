import { useState } from 'react';
import { Search, MapPin, Sparkles, Lock, Shield, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PropertySearchBar() {
  const [zipCode, setZipCode] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (zipCode.length === 5) {
      setShowAuthModal(true);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = `/investor/login?search=${zipCode}`;
  };

  return (
    <section id="property-search" className="py-16 bg-gradient-to-b from-[#111827] to-[#0a0f1a]">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-[#d4a574] mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">Powered by Penny AI</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Evaluate Any Market in the US
          </h2>
          <p className="text-gray-400 text-lg">
            Enter a ZIP code to begin your compliant acquisition evaluation with AI-powered market analysis
          </p>
        </div>

        <form onSubmit={handleSearch} className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input aria-label="Enter ZIP Code (e.g., 78701)"
                type="text"
                placeholder="Enter ZIP Code (e.g., 78701)"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4a574] text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={zipCode.length !== 5}
              className="bg-gradient-to-r from-[#d4a574] to-[#c49464] text-[#0a0f1a] px-8 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-[#d4a574]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5" />
              Start Evaluation
            </button>
          </div>
          
          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Compliance-First Approach</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#d4a574]" />
              <span>Address Protected Until Funded</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span>YP Credits Available</span>
            </div>
          </div>
          
          <p className="text-gray-500 text-sm mt-4 text-center">
            Fund your account to unlock full property details and Penny AI market analysis
          </p>
        </form>
      </div>

      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#d4a574]" />
              {authMode === 'signup' ? 'Start Your Evaluation' : 'Welcome Back'}
            </DialogTitle>
            <DialogDescription>
              {authMode === 'signup' 
                ? 'Create an account to access our compliance-driven acquisition engine'
                : 'Log in to continue your acquisition journey'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-[#d4a574] hover:bg-[#c49564]">
              {authMode === 'signup' ? 'Create Account & Evaluate' : 'Log In & Continue'}
            </Button>
            <p className="text-center text-sm text-gray-600">
              {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
              <button type="button" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} className="text-[#d4a574] ml-1 hover:underline">
                {authMode === 'signup' ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
