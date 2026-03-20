import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth, UserRole } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Activity, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { t } = useTranslation(); // Initialize translation hook
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordLength', 'Password must be at least 6 characters'));
      return;
    }

    if (!role) {
      setError(t('auth.selectRole', 'Please select a role'));
      return; 
    }

    setLoading(true);
    try {
      await signup(name, email, password, role);
      navigate(role === 'patient' ? '/onboarding' : '/physiotherapist/dashboard');
    } catch (err) {
      setError(t('auth.signupFailed', 'Failed to create account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Illustration */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#5a9fb8] via-[#4a7c99] to-[#3a6b84] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-16 text-white">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-12 text-center"
          >
            <Activity className="w-24 h-24 mb-6 mx-auto" strokeWidth={1.5} />
            <h1 className="text-5xl mb-4">Physio-Check</h1>
            <p className="text-xl text-white/90 max-w-md text-center">
              {t('signup.subtitle', 'Real-time Exercise Analysis with AI-Powered Pose Estimation')}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="grid grid-cols-2 gap-8 max-w-2xl"
          >
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
              <div className="w-12 h-12 bg-white/20 rounded-xl mb-4 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="mb-2">{t('signup.feature1Title', 'Real-time Feedback')}</h3>
              <p className="text-sm text-white/80">
                {t('signup.feature1Desc', 'Get instant posture corrections and rep counting with MediaPipe AI')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
              <div className="w-12 h-12 bg-white/20 rounded-xl mb-4 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="mb-2">{t('signup.feature2Title', 'Progress Tracking')}</h3>
              <p className="text-sm text-white/80">
                {t('signup.feature2Desc', 'Track your range of motion and accuracy across sessions')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
              <div className="w-12 h-12 bg-white/20 rounded-xl mb-4 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="mb-2">{t('signup.feature3Title', 'Expert Guidance')}</h3>
              <p className="text-sm text-white/80">
                {t('signup.feature3Desc', 'Connect with physiotherapists for personalized programs')}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
              <div className="w-12 h-12 bg-white/20 rounded-xl mb-4 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="mb-2">{t('signup.feature4Title', 'Voice Commands')}</h3>
              <p className="text-sm text-white/80">
                {t('signup.feature4Desc', 'Hands-free TTS guidance during your workout sessions')}
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-3xl mb-2">{t('auth.createAccount', 'Create Account')}</h2>
            <p className="text-muted-foreground">
              {t('signup.formSubtitle', 'Join Physio-Check to start your recovery journey')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t('auth.fullName', 'Full Name')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-11 h-12 bg-input-background rounded-xl"
                />
              </div>
            </div>

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
                  className="pl-11 h-12 bg-input-background rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 pr-11 h-12 bg-input-background rounded-xl"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-11 pr-11 h-12 bg-input-background rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('auth.roleLabel', 'I am a')}</Label>
              <div className="grid grid-cols-2 gap-3">
               <button
                  type="button"
                  onClick={() => {
                    setRole('patient');
                  }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    role === 'patient'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{t('auth.rolePatient', 'Patient')}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('auth.rolePatientDesc', 'Start my recovery')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('physiotherapist')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    role === 'physiotherapist'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">{t('auth.rolePhysio', 'Physiotherapist')}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t('auth.rolePhysioDesc', 'Help patients')}
                  </div>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              {loading ? t('auth.creatingAccount', 'Creating Account...') : t('auth.createAccount', 'Create Account')}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">{t('auth.alreadyHaveAccount', 'Already have an account?')} </span>
              <Link to="/login" className="text-primary hover:underline">
                {t('auth.signIn', 'Sign in')}
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}