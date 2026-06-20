import { useMemo } from 'react';
import { Check, X, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  key: string;
}

const requirements: PasswordRequirement[] = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'One uppercase letter (A-Z)',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'One lowercase letter (a-z)',
    test: (password) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'One number (0-9)',
    test: (password) => /[0-9]/.test(password),
  },
  {
    key: 'special',
    label: 'One special character (!@#$%^&*)',
    test: (password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  },
];

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const analysis = useMemo(() => {
    const results = requirements.map((req) => ({
      ...req,
      met: req.test(password),
    }));
    
    const metCount = results.filter((r) => r.met).length;
    const totalCount = requirements.length;
    const percentage = (metCount / totalCount) * 100;
    
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    let strengthLabel = 'Weak';
    let strengthColor = 'bg-red-500';
    let textColor = 'text-red-600';
    
    if (percentage >= 100) {
      strength = 'strong';
      strengthLabel = 'Strong';
      strengthColor = 'bg-green-500';
      textColor = 'text-green-600';
    } else if (percentage >= 80) {
      strength = 'good';
      strengthLabel = 'Good';
      strengthColor = 'bg-blue-500';
      textColor = 'text-blue-600';
    } else if (percentage >= 60) {
      strength = 'fair';
      strengthLabel = 'Fair';
      strengthColor = 'bg-amber-500';
      textColor = 'text-amber-600';
    }
    
    return {
      results,
      metCount,
      totalCount,
      percentage,
      strength,
      strengthLabel,
      strengthColor,
      textColor,
    };
  }, [password]);

  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const ShieldIcon = analysis.strength === 'strong' 
    ? ShieldCheck 
    : analysis.strength === 'weak' 
      ? ShieldAlert 
      : Shield;

  return (
    <div className="mt-2 space-y-3">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldIcon className={`w-4 h-4 ${analysis.textColor}`} />
            <span className={`text-xs font-medium ${analysis.textColor}`}>
              Password Strength: {analysis.strengthLabel}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {analysis.metCount}/{analysis.totalCount} requirements
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${analysis.strengthColor}`}
            style={{ width: `${analysis.percentage}%` }}
          />
        </div>
        
        {/* Segmented Strength Indicator */}
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                index < analysis.metCount
                  ? analysis.strengthColor
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirements List */}
      {showRequirements && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Password Requirements:
          </p>
          <ul className="space-y-1.5">
            {analysis.results.map((req) => (
              <li
                key={req.key}
                className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                  req.met ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                    req.met
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {req.met ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : (
                    <X className="w-3 h-3" strokeWidth={2} />
                  )}
                </span>
                <span className={req.met ? 'line-through opacity-70' : ''}>
                  {req.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Helpful Tips */}
      {analysis.strength === 'weak' && password.length > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
          <strong>Tip:</strong> Try adding uppercase letters, numbers, and special characters to make your password stronger.
        </div>
      )}
      
      {analysis.strength === 'strong' && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>Great! Your password meets all security requirements.</span>
        </div>
      )}
    </div>
  );
}

// Export validation function for use in form validation
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
