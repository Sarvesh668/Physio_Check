//E:\techfiesta_final\Physio_Check\frontend\src\app\pages\patient\WorkoutSummary.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  Target,
  Activity,
  ArrowRight,
  Home
} from 'lucide-react';
import { motion } from 'motion/react';
import { Exercise } from '../../data/exercises';

interface LocationState {
  metrics: {
    total_reps: number;
    correct_reps: number;
    accuracy: number;
    duration: number;
  };
  exercise: Exercise;
}

export function WorkoutSummary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  if (!state) {
    navigate('/dashboard');
    return null;
  }

  const { metrics, exercise } = state;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}${t('common.minutesAbbr', 'm')} ${secs}${t('common.secondsAbbr', 's')}`;
  };

  const getPerformanceMessage = () => {
    if (metrics.accuracy >= 90) return t('workoutSummary.performanceExcellent', "Excellent work! Your form was outstanding.");
    if (metrics.accuracy >= 75) return t('workoutSummary.performanceGreat', "Great job! Keep focusing on your technique.");
    if (metrics.accuracy >= 60) return t('workoutSummary.performanceGood', "Good effort! Practice will improve your form.");
    return t('workoutSummary.performanceKeepPracticing', "Keep practicing! Focus on the posture cues.");
  };

  const getPerformanceColor = () => {
    if (metrics.accuracy >= 90) return "text-green-600";
    if (metrics.accuracy >= 75) return "text-blue-600";
    if (metrics.accuracy >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full"
      >
        {/* Success Header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl mb-2">{t('workoutSummary.complete', 'Workout Complete!')}</h1>
          <p className="text-muted-foreground">
            {t('workoutSummary.successSubtitle', `You've successfully completed {{name}}`, { name: t(`exercises.${exercise.id}.name`, exercise.name) })}
          </p>
        </motion.div>

        {/* Main Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <p className="text-3xl mb-1">{metrics.total_reps}</p>
            <p className="text-sm text-muted-foreground">{t('common.totalReps', 'Total Reps')}</p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-3xl mb-1">{metrics.correct_reps}</p>
            <p className="text-sm text-muted-foreground">{t('common.correctReps', 'Correct Reps')}</p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-3xl mb-1">{metrics.accuracy}%</p>
            <p className="text-sm text-muted-foreground">{t('common.accuracy', 'Accuracy')}</p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-3xl mb-1">{formatDuration(metrics.duration)}</p>
            <p className="text-sm text-muted-foreground">{t('common.duration', 'Duration')}</p>
          </Card>
        </motion.div>

        {/* Performance Feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-muted ${getPerformanceColor()}`}>
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2">{t('workoutSummary.performanceTitle', 'Performance Feedback')}</h3>
                <p className="text-muted-foreground mb-4">{getPerformanceMessage()}</p>
                <div className="flex flex-wrap gap-2">
                  {metrics.accuracy >= 75 && (
                    <Badge className="bg-green-100 text-green-700">{t('workoutSummary.excellentForm', 'Excellent Form')}</Badge>
                  )}
                  {metrics.total_reps >= 10 && (
                    <Badge className="bg-blue-100 text-blue-700">{t('workoutSummary.strongEndurance', 'Strong Endurance')}</Badge>
                  )}
                  {metrics.correct_reps === metrics.total_reps && metrics.total_reps > 0 && (
                    <Badge className="bg-purple-100 text-purple-700">{t('workoutSummary.perfectSession', 'Perfect Session')}</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* AI Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <h3 className="mb-3">{t('workoutSummary.aiAnalysisTitle', 'AI Analysis')}</h3>
            <ul className="space-y-2 text-sm">
              {metrics.accuracy >= 80 ? (
                <>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.excellentConsistency', 'Your form consistency has been excellent throughout the session')}</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.speedControlled', 'Movement speed is well-controlled')}</span>
                  </li>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.increaseDifficulty', 'Consider gradually increasing difficulty in next sessions')}</span>
                  </li>
                </>
              ) : metrics.accuracy >= 60 ? (
                <>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.goodEffort', "Good effort - you're making progress")}</span>
                  </li>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.focusROM', 'Focus on completing full range of motion for each rep')}</span>
                  </li>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.reviewPosture', 'Review the posture cues to improve technique')}</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.workROM', 'Work on achieving full range of motion')}</span>
                  </li>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.properFormOverSpeed', 'Take your time and focus on proper form over speed')}</span>
                  </li>
                  <li className="flex gap-2">
                    <Activity className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{t('workoutSummary.aiAnalysis.reviewInstructions', 'Consider reviewing the exercise instructions before your next session')}</span>
                  </li>
                </>
              )}
            </ul>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="flex-1 h-12"
          >
            <Home className="w-5 h-5 mr-2" />
            {t('common.backToDashboard', 'Back to Dashboard')}
          </Button>
          <Button
            onClick={() => navigate('/reports')}
            className="flex-1 h-12 bg-primary hover:bg-primary/90"
          >
            {t('workoutSummary.viewAnalytics', 'View Detailed Analytics')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>

        {/* Auto-save message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          {t('workoutSummary.autoSave', 'Your progress has been saved automatically')}
        </motion.p>
      </motion.div>
    </div>
  );
}
