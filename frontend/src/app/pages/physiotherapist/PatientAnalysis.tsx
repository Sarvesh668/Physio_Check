import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PhysiotherapistLayout } from '../../components/layouts/PhysiotherapistLayout';
import { ExerciseAnalysis } from '../../components/ExerciseAnalysis';
import { Button } from '../../components/ui/button';
import { ChevronLeft, User, Mail, Calendar } from 'lucide-react';
import { Card } from '../../components/ui/card';

interface Patient {
  id: string;
  name: string;
  email: string;
  onboarding: {
    age: string;
    reason: string;
  };
}

export function PatientAnalysis() {
  const { t } = useTranslation();
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (patientId) {
      fetch(`https://physio-check.onrender.com/patient/${patientId}`)
        .then(res => res.json())
        .then(data => setPatient(data.patient))
        .catch(err => console.error("Error fetching patient:", err));
    }
  }, [patientId]);

  return (
    <PhysiotherapistLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(`/physiotherapist/patient/${patientId}`)}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t('physioAnalysis.backToProfile', 'Back to Patient Profile')}
          </Button>
        </div>

        {patient && (
          <Card className="p-6 bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                {patient.name.charAt(0)}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <h1 className="text-3xl font-bold">{patient.name}</h1>
                  <div className="flex items-center text-muted-foreground gap-2">
                    <Mail className="w-4 h-4" /> {patient.email}
                  </div>
                  <div className="flex items-center text-muted-foreground gap-2">
                    <Calendar className="w-4 h-4" /> {patient.onboarding?.age} {t('common.years', 'years')}
                  </div>
                </div>
                <p className="text-sm bg-background/50 inline-block px-3 py-1 rounded-full border border-primary/10">
                  <span className="font-bold text-primary mr-2">{t('physioAnalysis.condition', 'Condition')}:</span>
                  {patient.onboarding?.reason}
                </p>
              </div>
            </div>
          </Card>
        )}

        <ExerciseAnalysis patientId={patientId || ''} isPhysioView={true} />
      </div>
    </PhysiotherapistLayout>
  );
}