import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import logoImage from '/logo.png';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const newPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, role, user, newPasswordRequired, completeNewPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // New password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    
    setLoading(true);
    const { error, newPasswordRequired: needsNewPassword } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else if (needsNewPassword) {
      toast.info('Please set a new password to continue.');
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = newPasswordSchema.safeParse({ newPassword, confirmNewPassword });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await completeNewPassword(newPassword);
    setLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#0F1E2E] px-6 pt-16 pb-8">
      {/* Logo section */}
      <div className="mb-12 flex flex-col items-center">
        <img
          src={logoImage}
          alt="Prime Pros"
          className="h-[180px] w-[260px] object-contain mb-4"
        />
        <h1 className="text-[2.5rem] font-bold text-foreground">
          <span className="text-prime-gold">PRIME</span>{' '}
          <span className="text-prime-white">PROS</span>
        </h1>
      </div>

      {/* Form section */}
      <div className="w-full max-w-sm">
        {newPasswordRequired ? (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Set New Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Please create a new password to continue
              </p>
            </div>
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-10 h-12 bg-[#1a2d42] border-[#2a3f54] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-10 h-12 bg-[#1a2d42] border-[#2a3f54] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-prime-gold hover:bg-prime-gold/90 text-prime-navy font-semibold text-base"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Set New Password'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground">Sign in to Prime Pros</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Titan Prime Solutions CRM
              </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Email address"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-10 h-12 bg-[#1a2d42] border-[#2a3f54] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-10 h-12 bg-[#1a2d42] border-[#2a3f54] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-prime-gold hover:bg-prime-gold/90 text-prime-navy font-semibold text-base"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
              </Button>
            </form>
            
            <div className="text-center">
              <button 
                type="button"
                className="text-prime-gold hover:text-prime-gold/80 text-sm font-medium"
                onClick={() => toast.info('Please contact your administrator to reset your password.')}
              >
                Forgot your password?
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
