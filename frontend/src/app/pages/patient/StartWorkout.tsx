import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { PatientLayout } from '../../components/layouts/PatientLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { exercises, categoryLabels, difficultyColors, ExerciseCategory } from '../../data/exercises';
import { Activity, Play, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export function StartWorkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');

  // Filter exercises by category
  const filteredExercises = selectedCategory === 'all' 
    ? exercises 
    : exercises.filter(ex => ex.category === selectedCategory);

  // Group exercises by category for display
  const exercisesByCategory = exercises.reduce((acc, exercise) => {
    if (!acc[exercise.category]) {
      acc[exercise.category] = [];
    }
    acc[exercise.category].push(exercise);
    return acc;
  }, {} as Record<ExerciseCategory, typeof exercises>);

  const categories: Array<ExerciseCategory | 'all'> = ['all', 'upper-body', 'lower-body'];

  return (
    <PatientLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl mb-2">{t('startWorkout.title', 'Start Your Workout')}</h1>
          <p className="text-muted-foreground">
            {t('startWorkout.subtitle', 'Choose an exercise to begin your session with real-time AI feedback')}
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {category === 'all' 
                  ? t('startWorkout.allExercises', 'All Exercises') 
                  : t(`exercises.category.${category}`, categoryLabels[category])}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Exercise Cards */}
        {selectedCategory === 'all' ? (
          // Show by category groups
          Object.entries(exercisesByCategory).map(([category, categoryExercises], categoryIndex) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + categoryIndex * 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl">{t(`exercises.category.${category}`, categoryLabels[category as ExerciseCategory])}</h3>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryExercises.map((exercise, index) => (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + categoryIndex * 0.1 + index * 0.05 }}
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                      onClick={() => navigate(`/workout/${exercise.id}`)}
                    >
                      <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                        <Activity className="w-12 h-12 text-muted-foreground/30 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                        <Badge className={`absolute top-3 right-3 ${difficultyColors[exercise.difficulty]}`}>
                          {t(`exercises.difficulty.${exercise.difficulty}`, exercise.difficulty)}
                        </Badge>
                      </div>
                      <div className="p-4">
                        <h4 className="mb-2 line-clamp-1">{t(`exercises.${exercise.id}.name`, exercise.name)}</h4>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {t(`exercises.${exercise.id}.description`, exercise.description)}
                        </p>
                        <Button
                          variant="outline"
                          className="w-full group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {t('common.start', 'Start')}
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))
        ) : (
          // Show filtered exercises
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredExercises.map((exercise, index) => (
              <motion.div
                key={exercise.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => navigate(`/workout/${exercise.id}`)}
                >
                  <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative overflow-hidden">
                    <Activity className="w-12 h-12 text-muted-foreground/30 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
                    <Badge className={`absolute top-3 right-3 ${difficultyColors[exercise.difficulty]}`}>
                      {t(`exercises.difficulty.${exercise.difficulty}`, exercise.difficulty)}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <h4 className="mb-2 line-clamp-1">{t(`exercises.${exercise.id}.name`, exercise.name)}</h4>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {t(`exercises.${exercise.id}.description`, exercise.description)}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {t('common.start', 'Start')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </PatientLayout>
  );
}