import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientLayout } from '../../components/layouts/PatientLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Lock, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export function Profile() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(name, email);
      setIsEditing(false);
      toast.success(t('profile.updateSuccess', 'Profile updated successfully!'));
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(t('profile.updateFailed', 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PatientLayout>
      <div className="max-w-4xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl mb-2">{t('profile.title', 'Profile Settings')}</h1>
          <p className="text-muted-foreground">
            {t('profile.subtitle', 'Manage your account information and preferences')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h3 className="mb-1">{user?.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{user?.email}</p>
                <Button variant="outline" size="sm">
                  {t('profile.changeAvatar', 'Change Avatar')}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('common.fullName', 'Full Name')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isEditing}
                      className="pl-11 bg-input-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.email', 'Email Address')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!isEditing}
                      className="pl-11 bg-input-background"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border flex justify-end gap-3">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90">
                    {t('profile.editBtn', 'Edit Profile')}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-8">
            <h3 className="mb-6">{t('profile.security', 'Security')}</h3>
            <Button variant="outline">
              <Lock className="w-4 h-4 mr-2" />
              {t('profile.changePassword', 'Change Password')}
            </Button>
          </Card>
        </motion.div>
      </div>
    </PatientLayout>
  );
}
