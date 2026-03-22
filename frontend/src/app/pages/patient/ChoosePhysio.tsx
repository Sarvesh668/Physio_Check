//C:\Users\soumy\final_2\PHYSIOCHECK\frontend\src\app\pages\patient\ChoosePhysio.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PatientLayout } from '../../components/layouts/PatientLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { User, ChevronRight, Search, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

interface Physiotherapist {
  id: string;
  name: string;
  email: string;
  specialty?: string;
  experience?: string;
}

export function ChoosePhysio() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, linkPhysio } = useAuth();
  const [physios, setPhysios] = useState<Physiotherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPhysios = async () => {
      try {
        const response = await fetch('https://physio-check.onrender.com/physiotherapists');
        const data = await response.json();
        if (response.ok) {
          setPhysios(data.physiotherapists);
        } else {
          toast.error(data.error || t('common.failedFetchPhysios', 'Failed to fetch physiotherapists'));
        }
      } catch (err) {
        console.error('Error fetching physios:', err);
        toast.error(t('common.connectionError', 'Connection error'));
      } finally {
        setLoading(false);
      }
    };

    fetchPhysios();
  }, [t]);

  const handleSelectPhysio = async (physioId: string) => {
    if (!user) return;
    
    setLinking(physioId);
    try {
      const response = await fetch('https://physio-check.onrender.com/link-physio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_id: user.id,
          physio_id: physioId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(t('choosePhysio.linkSuccess', 'Physiotherapist linked successfully!'));
        linkPhysio(physioId);
        navigate('/dashboard');
      } else {
        toast.error(data.error || t('choosePhysio.linkError', 'Failed to link physiotherapist'));
      }
    } catch (err) {
      console.error('Error linking physio:', err);
      toast.error(t('common.connectionError', 'Connection error'));
    } finally {
      setLinking(null);
    }
  };

  const filteredPhysios = physios.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PatientLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold mb-4">{t('choosePhysio.title', 'Choose Your Physiotherapist')}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('choosePhysio.subtitle', 'Select an expert to guide you through your recovery journey. You can change this later in your settings.')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative max-w-md mx-auto"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder={t('choosePhysio.searchPlaceholder', 'Search by name...')}
            className="pl-11 h-12 bg-white shadow-sm border-0 focus-visible:ring-primary/20 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">{t('choosePhysio.loading', 'Finding experts for you...')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhysios.map((physio, index) => (
              <motion.div
                key={physio.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-6 hover:shadow-xl transition-all duration-300 border-0 shadow-md group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                      {physio.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{physio.name}</h3>
                      <p className="text-sm text-muted-foreground">{physio.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="w-4 h-4 text-primary" />
                      <span>{t('choosePhysio.certifiedPhysio', 'Certified Physiotherapist')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4 text-primary" />
                      <span>{t('choosePhysio.specialistMobility', 'Specialist in Mobility')}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleSelectPhysio(physio.id)}
                    disabled={!!linking}
                    className="w-full h-12 rounded-xl text-lg font-medium group-hover:scale-[1.02] transition-transform"
                  >
                    {linking === physio.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('choosePhysio.linking', 'Linking...')}
                      </div>
                    ) : (
                      <>
                        {t('choosePhysio.selectSpecialist', 'Select Specialist')}
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredPhysios.length === 0 && (
          <div className="text-center py-20">
            <User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t('choosePhysio.noPhysiosFound', 'No physiotherapists found')}</h3>
            <p className="text-muted-foreground">{t('choosePhysio.adjustSearch', 'Try adjusting your search terms.')}</p>
          </div>
        )}
      </div>
    </PatientLayout>
  );
}
