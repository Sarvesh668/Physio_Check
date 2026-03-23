import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PatientLayout } from '../../components/layouts/PatientLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Activity, TrendingUp, Calendar, Play, BarChart3, Target, Video, ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { retryPendingSync } from '../../services/workoutSessionService';
import { fetchCustomExercises } from '../../services/exerciseService'; // NEW IMPORT
import { EXERCISE_CONFIGS } from '../../config/exerciseConfigs'; // NEW IMPORT
import { toast } from 'sonner';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';

interface AssignedExercise {
  name: string;
  video_url: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation(); 
  const [assignedExercises, setAssignedExercises] = useState<AssignedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [statsData, setStatsData] = useState({
    sessionsThisWeek: 0,
    streak: 0,
    avgAccuracy: 0,
    totalSessions: 0
  });

  useEffect(() => {
    retryPendingSync().catch(console.error);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getFirestoreDb();
    
    // FETCH CUSTOM DYNAMIC EXERCISES INTO MEMORY FIRST!
    fetchCustomExercises().then(() => {
        // 1. Fetch Assigned Exercises
        const docRef = doc(db, 'assigned_exercises', user.id);
        onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setAssignedExercises(data.exercises || []);
          } else {
            setAssignedExercises([]);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to exercise updates:', error);
          toast.error(t('dashboard.syncError', 'Failed to sync exercises in real-time'));
          setLoading(false);
        });
    });

    // 2. Fetch Actual Workout Stats
    const fetchStats = async () => {
      try {
        const sessionsRef = collection(db, 'patient_sessions', user.id, 'sessions');
        const snapshot = await getDocs(sessionsRef);
        
        let totalAcc = 0;
        let totalSessions = snapshot.size;
        let thisWeekCount = 0;
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const dates: Date[] = [];

        snapshot.forEach(doc => {
          const data = doc.data();
          totalAcc += data.accuracy || 0;
          
          let sessionDate = new Date();
          if (data.timestamp) sessionDate = new Date(data.timestamp);
          else if (data.server_timestamp) sessionDate = new Date(data.server_timestamp);

          dates.push(sessionDate);

          if (sessionDate > oneWeekAgo) {
            thisWeekCount++;
          }
        });

        const avgAccuracy = totalSessions > 0 ? Math.round(totalAcc / totalSessions) : 0;

        let currentStreak = 0;
        if (dates.length > 0) {
          dates.sort((a, b) => b.getTime() - a.getTime()); 
          const uniqueDays = [...new Set(dates.map(d => d.toISOString().split('T')[0]))];
          
          const todayStr = now.toISOString().split('T')[0];
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (uniqueDays[0] === todayStr || uniqueDays[0] === yesterdayStr) {
            currentStreak = 1;
            let checkDate = new Date(uniqueDays[0]);
            
            for (let i = 1; i < uniqueDays.length; i++) {
              const expectedNextDay = new Date(checkDate);
              expectedNextDay.setDate(expectedNextDay.getDate() - 1);
              const expectedStr = expectedNextDay.toISOString().split('T')[0];
              
              if (uniqueDays[i] === expectedStr) {
                currentStreak++;
                checkDate = expectedNextDay;
              } else {
                break;
              }
            }
          }
        }

        setStatsData({
          totalSessions,
          avgAccuracy,
          sessionsThisWeek: thisWeekCount,
          streak: currentStreak
        });

      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    };

    fetchStats();
  }, [user?.id, t]);

  const stats = [
    { label: t('dashboard.stats.sessionsThisWeek', 'Sessions This Week'), value: statsData.sessionsThisWeek.toString(), icon: Activity, color: 'text-primary', trend: t('dashboard.stats.last7Days', 'Last 7 days') },
    { label: t('dashboard.stats.currentStreak', 'Current Streak'), value: `${statsData.streak} ${t('dashboard.stats.days', 'Days')}`, icon: Calendar, color: 'text-amber-600', trend: statsData.streak > 0 ? t('dashboard.stats.active', 'Active') : t('dashboard.stats.startToday', 'Start today!') },
    { label: t('dashboard.stats.avgAccuracy', 'Avg. Accuracy'), value: `${statsData.avgAccuracy}%`, icon: TrendingUp, color: 'text-green-600', trend: t('dashboard.stats.overallAccuracy', 'Overall accuracy') },
    { label: t('dashboard.stats.totalSessions', 'Total Sessions'), value: statsData.totalSessions.toString(), icon: Target, color: 'text-blue-600', trend: t('dashboard.stats.allTime', 'All time') }
  ];

  const getExerciseTargetId = (dbName: string) => {
    const nameRaw = dbName.toLowerCase();
    
    // 1. Try to find the exact match from the injected Dynamic Configs
    const configs = Object.values(EXERCISE_CONFIGS);
    const matchedConfig = configs.find(c => c.name.toLowerCase() === nameRaw || c.id === dbName);
    if (matchedConfig) return matchedConfig.id;

    // 2. Fallbacks for standard exercises
    if (nameRaw.includes('rotator') || nameRaw.includes('cuff')) return 'rotator-cuff';
    if (nameRaw.includes('wall') || nameRaw.includes('slide')) return 'wall-slides';
    if (nameRaw.includes('side') || nameRaw.includes('raise')) return 'side-raises';
    
    return dbName.trim().toLowerCase().replace(/\s+/g, '-');
  };

  return (
    <PatientLayout>
      <div className="max-w-6xl mx-auto space-y-10">
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <p className="text-sm font-medium text-primary mb-1 tracking-wide uppercase">{t('dashboard.portalName', 'Physio-Check Portal')}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {t('dashboard.hello', 'Hello, {{name}}', { name: user?.name?.split(' ')[0] || 'there' })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('dashboard.overview', 'Here is your active recovery overview for today.')}
            </p>
          </div>
          <Button 
            onClick={() => navigate('/start-workout')}
            className="shrink-0 rounded-full px-6"
          >
            {t('dashboard.startSession', 'Start Session')} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map((stat, index) => (
            <Card key={stat.label} className="p-5 border-border/50 shadow-sm hover:shadow transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color} opacity-70`} />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-semibold">{stat.value}</span>
                <span className="text-xs text-muted-foreground mt-1">{stat.trend}</span>
              </div>
            </Card>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div 
            className="lg:col-span-2 space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">{t('dashboard.yourPlan', 'Your Plan')}</h2>
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t('dashboard.syncing', 'Syncing')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {assignedExercises.length > 0 ? (
                assignedExercises.map((exercise, index) => {
                  const targetId = getExerciseTargetId(exercise.name);

                  return (
                    <Card key={index} className="overflow-hidden border-border/50 shadow-sm flex flex-col group">
                      <div className="aspect-video bg-muted/30 relative flex items-center justify-center border-b border-border/30">
                        {exercise.video_url ? (
                          <video 
                            src={exercise.video_url} 
                            className="w-full h-full object-cover"
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <Video className="w-8 h-8 text-muted-foreground/20" />
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1 justify-between gap-4">
                        <h3 className="font-medium text-foreground">{exercise.name}</h3>
                        <div className="flex gap-2 w-full">
                          <Button 
                            variant="secondary"
                            className="flex-1 text-xs h-9 bg-secondary/50 hover:bg-secondary"
                            onClick={() => navigate(`/workout/${targetId}`, { 
                              state: { videoUrl: exercise.video_url } 
                            })}
                          >
                            <Play className="w-3 h-3 mr-2" /> {t('dashboard.startBtn', 'Start')}
                          </Button>
                          {exercise.video_url && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(exercise.video_url, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : !loading ? (
                <Card className="col-span-full p-10 text-center border-dashed border-border/50 shadow-none bg-transparent">
                  <p className="text-muted-foreground mb-4">{t('dashboard.noExercises', 'No exercises assigned right now.')}</p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/choose-physio')}>
                    {t('dashboard.connectPhysio', 'Connect with a Physiotherapist')}
                  </Button>
                </Card>
              ) : (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-[220px] bg-muted/40 animate-pulse rounded-xl border border-border/30" />
                ))
              )}
            </div>
          </motion.div>

          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h2 className="text-xl font-semibold tracking-tight">{t('dashboard.quickLinks', 'Quick Links')}</h2>
            <div className="space-y-3">
              <Card className="p-1 border-border/50 shadow-sm hover:border-primary/30 transition-colors">
                <Button 
                  variant="ghost" 
                  className="w-full h-auto justify-start p-4 hover:bg-transparent"
                  onClick={() => navigate('/start-workout')}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                      <Play className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-sm text-foreground">{t('dashboard.library', 'Library')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.libraryDesc', 'Browse all exercises')}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50" />
                  </div>
                </Button>
              </Card>

              <Card className="p-1 border-border/50 shadow-sm hover:border-blue-500/30 transition-colors">
                <Button 
                  variant="ghost" 
                  className="w-full h-auto justify-start p-4 hover:bg-transparent"
                  onClick={() => navigate('/reports')}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-600">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-sm text-foreground">{t('dashboard.analytics', 'Analytics')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.analyticsDesc', 'View your progress')}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50" />
                  </div>
                </Button>
              </Card>
            </div>
          </motion.div>

        </div>
      </div>
    </PatientLayout>
  );
}