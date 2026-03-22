import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Activity, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { t } = useTranslation(); // Initialize translation hook
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const loggedInUser = JSON.parse(storedUser);
        
        // RESTORED: Check onboarding status for patients
        if (loggedInUser.role === 'patient') {
          navigate(loggedInUser.onboarded ? (loggedInUser.physio_id ? '/dashboard' : '/choose-physio') : '/onboarding');
        } else {
          navigate('/physiotherapist/dashboard');
        }
      }
    } catch (err) {
      setError(t('auth.invalidLogin', 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#f8fafc] to-[#e8eef1]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4"
            >
              <Activity className="w-8 h-8 text-primary" strokeWidth={2} />
            </motion.div>
            <h2 className="text-3xl mb-2">{t('auth.welcomeBack', 'Welcome Back')}</h2>
            <p className="text-muted-foreground">
              {t('auth.signInDesc', 'Sign in to continue your recovery journey')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-destructive/10 text-destructive rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email', 'Email Address')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 h-12 bg-input-background rounded-xl border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t('auth.forgotPassword', 'Forgot password?')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 pr-11 h-12 bg-input-background rounded-xl border-0 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                {t('auth.rememberMe', 'Remember me for 30 days')}
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 transition-all"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {t('auth.signingIn', 'Signing in...')}
                </div>
              ) : (
                t('auth.signIn', 'Sign In')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-muted-foreground">
                  {t('auth.noAccount', "Don't have an account?")}
                </span>
              </div>
            </div>
            <Link to="/signup">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl mt-4 border-2 hover:border-primary hover:text-primary transition-all"
              >
                {t('auth.createAccount', 'Create Account')}
              </Button>
            </Link>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>
              {t('auth.agreeText', 'By signing in, you agree to our')}{' '}
              <a href="#" className="text-primary hover:underline">
                {t('auth.terms', 'Terms of Service')}
              </a>{' '}
              {t('auth.and', 'and')}{' '}
              <a href="#" className="text-primary hover:underline">
                {t('auth.privacy', 'Privacy Policy')}
              </a>
            </p>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          {t('auth.demoText', 'Demo: Use any email to sign in or create an account')}
        </motion.p>
      </motion.div>
    </div>
  );
}