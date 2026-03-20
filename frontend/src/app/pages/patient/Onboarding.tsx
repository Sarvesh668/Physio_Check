import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card } from '../../components/ui/card';
import { motion } from 'motion/react';
import { User, Calendar, Ruler, Weight, MessageSquare, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setOnboarded } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: '',
    referred_by: '',
    height: '',
    weight: '',
    reason: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://physio-check.onrender.com/patient/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          ...formData
        }),
      });

      if (response.ok) {
        setOnboarded(true);
        navigate('/choose-physio');
      } else {
        const data = await response.json();
        toast.error(data.error || t('onboarding.failed', 'Onboarding failed'));
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      toast.error(t('common.connectionError', 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('onboarding.welcome', 'Welcome to Physio-Check')}</h1>
          <p className="text-muted-foreground">{t('onboarding.subtitle', 'Please tell us more about yourself to personalize your experience.')}</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.fullName', 'Full Name')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="pl-11 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">{t('common.age', 'Age')}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={handleChange}
                    required
                    className="pl-11 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">{t('common.height', 'Height (cm)')}</Label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="height"
                    type="number"
                    value={formData.height}
                    onChange={handleChange}
                    required
                    className="pl-11 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">{t('common.weight', 'Weight (kg)')}</Label>
                <div className="relative">
                  <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="weight"
                    type="number"
                    value={formData.weight}
                    onChange={handleChange}
                    required
                    className="pl-11 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="referred_by">{t('onboarding.referredBy', 'Referred By')}</Label>
                <div className="relative">
                  <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="referred_by"
                    value={formData.referred_by}
                    onChange={handleChange}
                    required
                    placeholder={t('onboarding.referredPlaceholder', "Doctor's name or clinic")}
                    className="pl-11 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reason">{t('onboarding.reason', 'Reason for Physiotherapy')}</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    required
                    placeholder={t('onboarding.reasonPlaceholder', 'Briefly describe your condition or goal')}
                    className="pl-11 min-h-[120px]"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg"
            >
              {loading ? t('common.submitting', 'Submitting...') : t('onboarding.submitBtn', 'Complete Onboarding')}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
