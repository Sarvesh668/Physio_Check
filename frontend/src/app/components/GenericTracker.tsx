/**
 * GenericTracker - Real-time Pose Detection and Skeleton Rendering
 * Handles MediaPipe integration, skeleton overlay, and exercise tracking
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pose, Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { ExerciseConfig, POSE_CONNECTIONS } from '../config/exerciseConfigs';
import { StrictPoseEngine, RepState } from '../engine/StrictPoseEngine';
import { getVoiceFeedback } from '../engine/VoiceFeedback';

interface GenericTrackerProps {
  config: ExerciseConfig;
  onRepComplete?: (repData: any) => void;
  onStateChange?: (state: RepState) => void;
  isPaused: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export function GenericTracker({
  config,
  onRepComplete,
  onStateChange,
  isPaused,
  onPause,
  onResume,
  onStop
}: GenericTrackerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StrictPoseEngine | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const voiceFeedbackRef = useRef(getVoiceFeedback());
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [correctReps, setCorrectReps] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [currentState, setCurrentState] = useState<RepState>('waiting');
  const [jointColor, setJointColor] = useState<'green' | 'yellow' | 'red'>('green');
  const [violations, setViolations] = useState<string[]>([]);

  // Initialize engine
  useEffect(() => {
    engineRef.current = new StrictPoseEngine(config);
    return () => {
      engineRef.current = null;
    };
  }, [config]);

  // Handle pause/resume
  useEffect(() => {
    if (!engineRef.current) return;
    
    if (isPaused) {
      engineRef.current.pause();
    } else {
      engineRef.current.resume();
    }
  }, [isPaused]);

  // Initialize MediaPipe Pose
  useEffect(() => {
    if (!videoRef.current) return;

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
    poseRef.current = pose;

    // Initialize camera
    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && videoRef.current) {
            await poseRef.current.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720
      });

      camera.start();
      cameraRef.current = camera;
      setIsInitialized(true);
    }

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, []);

  // Process pose results
  const onPoseResults = useCallback((results: Results) => {
    if (!canvasRef.current || !engineRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      // Draw pose skeleton
      drawSkeleton(ctx, results.poseLandmarks, canvas.width, canvas.height);

      // Calculate angle for primary joint
      const angle = calculatePrimaryAngle(results.poseLandmarks);
      
      if (angle !== null) {
        setCurrentAngle(angle);

        // Update engine
        const state = engineRef.current.update(angle);
        
        // Update UI state
        setRepCount(state.repCount);
        setCorrectReps(state.correctReps);
        setAccuracy(engineRef.current.getAccuracy());
        setCurrentState(state.currentState);
        setJointColor(engineRef.current.getJointColor());
        setViolations(state.violations);

        // Check for rep completion
        if (state.currentState === 'complete' && state.repHistory.length > repCount) {
          const lastRep = state.repHistory[state.repHistory.length - 1];
          
          // Voice feedback
          if (lastRep.quality >= 70) {
            voiceFeedbackRef.current.announceCorrectRep(lastRep.repNumber);
          } else {
            voiceFeedbackRef.current.announceIncompleteRange();
          }

          if (onRepComplete) {
            onRepComplete(lastRep);
          }
        }

        // State change callback
        if (onStateChange && state.currentState !== currentState) {
          onStateChange(state.currentState);
        }

        // Draw angle annotation
        drawAngleAnnotation(ctx, results.poseLandmarks, angle, canvas.width, canvas.height);
      }

      // Draw alignment guides
      drawAlignmentGuides(ctx, results.poseLandmarks, canvas.width, canvas.height);
    }
  }, [config, onRepComplete, onStateChange, currentState, repCount]);

  // Calculate primary joint angle
  const calculatePrimaryAngle = (landmarks: any[]): number | null => {
    const { primaryJoint } = config;
    
    const p1 = landmarks[primaryJoint.point1];
    const p2 = landmarks[primaryJoint.point2];
    const p3 = landmarks[primaryJoint.point3];

    if (!p1 || !p2 || !p3) return null;

    return StrictPoseEngine.calculateAngle(
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p2.y },
      { x: p3.x, y: p3.y }
    );
  };

  // Draw skeleton connections and joints
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) => {
    // Draw connections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;

    for (const [start, end] of POSE_CONNECTIONS) {
      const p1 = landmarks[start];
      const p2 = landmarks[end];

      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Draw joints
    landmarks.forEach((landmark, index) => {
      if (landmark.visibility > 0.5) {
        const x = landmark.x * width;
        const y = landmark.y * height;

        // Determine color based on if it's the primary joint
        let color = 'rgba(255, 255, 255, 0.8)';
        let radius = 4;

        if (index === config.primaryJoint.point2) {
          // Primary joint (vertex)
          radius = 8;
          if (jointColor === 'green') {
            color = '#10b981';
          } else if (jointColor === 'yellow') {
            color = '#f59e0b';
          } else {
            color = '#ef4444';
          }
        } else if (
          index === config.primaryJoint.point1 ||
          index === config.primaryJoint.point3
        ) {
          // Angle measurement points
          radius = 6;
          color = 'rgba(74, 124, 153, 0.9)';
        }

        // Draw joint dot
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Draw outer ring for primary joint
        if (index === config.primaryJoint.point2) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });
  };

  // Draw angle annotation
  const drawAngleAnnotation = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    angle: number,
    width: number,
    height: number
  ) => {
    const { primaryJoint } = config;
    const vertex = landmarks[primaryJoint.point2];

    if (!vertex || vertex.visibility < 0.5) return;

    const x = vertex.x * width;
    const y = vertex.y * height;

    // Calculate position for angle label (offset from joint)
    const offsetX = 30;
    const offsetY = -30;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x + offsetX - 5, y + offsetY - 20, 70, 28);

    // Draw angle text
    ctx.fillStyle = jointColor === 'green' ? '#10b981' : 
                     jointColor === 'yellow' ? '#f59e0b' : '#ef4444';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${angle.toFixed(1)}°`, x + offsetX, y + offsetY);

    // Draw joint label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '12px sans-serif';
    ctx.fillText(t(`exercises.joints.${primaryJoint.label.toLowerCase().replace(' ', '')}`, primaryJoint.label), x + offsetX, y + offsetY + 15);
  };

  // Draw alignment guides
  const drawAlignmentGuides = (
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) => {
    if (!config.secondaryConstraints) return;

    for (const constraint of config.secondaryConstraints) {
      if (constraint.type === 'alignment' && constraint.points.length === 2) {
        const p1 = landmarks[constraint.points[0]];
        const p2 = landmarks[constraint.points[1]];

        if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || window.innerWidth;
        canvasRef.current.height = videoRef.current.videoHeight || window.innerHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video feed (hidden, used for MediaPipe processing) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} // Mirror for natural movement
        playsInline
      />

      {/* Canvas overlay for skeleton and annotations */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scaleX(-1)' }} // Mirror to match video
      />

      {/* Metrics overlay */}
      <div className="absolute top-6 left-6 right-6 flex flex-wrap gap-4 z-10">
        <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-6 py-4 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-white/60 mb-1">{t('common.totalReps', 'Total Reps')}</p>
              <p className="text-2xl">{repCount}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">{t('common.correctReps', 'Correct Reps')}</p>
              <p className="text-2xl text-green-400">{correctReps}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">{t('common.accuracy', 'Accuracy')}</p>
              <p className="text-2xl">{accuracy}%</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">{t('tracker.currentAngle', 'Current Angle')}</p>
              <p className="text-2xl">{currentAngle.toFixed(1)}°</p>
            </div>
          </div>
        </div>

        {/* State indicator */}
        <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-4 py-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              currentState === 'waiting' ? 'bg-gray-400' :
              currentState === 'extending' ? 'bg-blue-400' :
              currentState === 'peak' ? 'bg-yellow-400' :
              currentState === 'flexing' ? 'bg-purple-400' :
              'bg-green-400'
            }`} />
            <span className="text-xs text-white/80 capitalize">{t(`tracker.state.${currentState}`, currentState)}</span>
          </div>
        </div>

        {/* Violations */}
        {violations.length > 0 && (
          <div className="bg-red-500/80 backdrop-blur-sm rounded-2xl px-4 py-2">
            <p className="text-xs text-white">{violations[0]}</p>
          </div>
        )}
      </div>

      {/* Initialization loader */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">{t('tracker.initializing', 'Initializing camera and pose detection...')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
