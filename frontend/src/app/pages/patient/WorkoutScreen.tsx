import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import * as faceapi from 'face-api.js';

import { getExerciseConfig, ReferenceData, EXERCISE_IDS, ExerciseConfig } from '../../config/exerciseConfigs'; 
import { fetchCustomExercises } from '../../services/exerciseService'; // NEW IMPORT
import { getVoiceFeedback } from '../../engine/VoiceFeedback';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Camera, Pause, Play, StopCircle, Volume2, VolumeX, AlertTriangle, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { handleExerciseCompletion, SessionSummary } from '../../services/workoutSessionService';

// ==========================================
// PHYS CHECK HD015 - PRO WORKFLOW ENGINE
// ==========================================
export interface Point { x: number; y: number; }
export interface RepData {
  rep_number: number;
  quality_score: number;
  dtw_deviation: number;
  correct: boolean;
  failure_reason: string;
}

export interface TrackerState {
  status: "WAITING" | "OUTBOUND" | "INBOUND";
  canStart: boolean;
  currentRepFailed: boolean;
  failureReason: string;
  feedbackMessage: string;
  totalReps: number;
  correctReps: number;
  wrongReps: number;
  accuracy: number;
  flashColor: string | null;
  isDiscomfortPaused: boolean;
  painScore: number;
}

const detectGesture = (landmarks: any[]) => {
    const rThumb = landmarks[22], rWrist = landmarks[16];
    const lThumb = landmarks[21], lWrist = landmarks[15];
    const threshold = 0.05; 
    
    let isUp = false;
    let isDown = false;
    let activePoint = null;

    if (rThumb && rWrist && rThumb.visibility > 0.5 && rWrist.visibility > 0.5) {
        if (rThumb.y < rWrist.y - threshold) { isUp = true; activePoint = rThumb; }
        else if (rThumb.y > rWrist.y + threshold) { isDown = true; activePoint = rThumb; }
    }
    
    if (!isUp && !isDown && lThumb && lWrist && lThumb.visibility > 0.5 && lWrist.visibility > 0.5) {
        if (lThumb.y < lWrist.y - threshold) { isUp = true; activePoint = lThumb; }
        else if (lThumb.y > lWrist.y + threshold) { isDown = true; activePoint = lThumb; }
    }

    return { isUp, isDown, activePoint };
};

export class PhysioTracker {
  private refData: ReferenceData;
  public state: "WAITING" | "OUTBOUND" | "INBOUND" = "WAITING";
  public canStart: boolean = false;
  public currentRepFailed: boolean = false;
  public failureReason: string = "";
  public feedbackMessage: string = i18n.t('workout.feedback.positionYourself', 'Position Yourself');
  
  public totalReps: number = 0;
  public correctReps: number = 0;
  public wrongReps: number = 0;
  public repHistory: RepData[] = [];
  
  private historyInternal: number[] = [];
  private historyVertical: number[] = [];
  private repKinematics: [number, number][] = [];
  
  private positioningTolerance = 30.0; 
  private startPoseTolerance = 35.0; 
  private dtwThreshold = 30.0;
  private tunnelTolerance = 30.0;

  public flashCounter = 0;
  public currentFlashColor: string | null = null;

  public isVoiceEnabled = true;
  private lastVoiceTime = 0;
  private voiceCooldown = 800;
  private faultStartTime: number | null = null;
  private spokenMidRep = false;

  public isWorkoutActive = false; 
  public isDiscomfortPaused = false;
  public currentPainScore = 0;
  public latestFaceBox: any = null; 
  public latestPainScore: number = 0; 

  private landmarkMap: { [key: string]: number } = {
      'LEFT_SHOULDER': 11, 'RIGHT_SHOULDER': 12,
      'LEFT_ELBOW': 13, 'RIGHT_ELBOW': 14,
      'LEFT_WRIST': 15, 'RIGHT_WRIST': 16,
      'LEFT_HIP': 23, 'RIGHT_HIP': 24
  };

  constructor(referenceData: ReferenceData) {
      this.refData = referenceData;
  }

  public speakAlert(text: string, overrideCooldown = false) {
      if (!this.isVoiceEnabled) return;
      const now = performance.now();
      if (!overrideCooldown && now - this.lastVoiceTime < this.voiceCooldown) return;
      this.lastVoiceTime = now;
      getVoiceFeedback().announce(text);
  }

  private angleDiff(a: number, b: number): number {
      let diff = Math.abs(a - b) % 360;
      return diff > 180 ? 360 - diff : diff;
  }

  private calculateAngle(p1: Point, p2: Point, p3: Point): number {
      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.hypot(v1.x, v1.y);
      const mag2 = Math.hypot(v2.x, v2.y);
      if (mag1 < 1e-6 || mag2 < 1e-6) return 90.0;
      const cosAngle = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
      return (Math.acos(cosAngle) * 180.0) / Math.PI;
  }

  private calculateVerticalAngle(p1: Point, p2: Point): number {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      return (Math.atan2(dy, dx) * 180.0) / Math.PI;
  }

  private calculateAlignmentAngle(p1: Point, p2: Point): number {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      if (Math.abs(dx) < 1e-6) return 90.0;
      return Math.abs((Math.atan2(dy, dx) * 180.0) / Math.PI);
  }

  private computeDTW(seq1: [number, number][], seq2: [number, number][]): number {
      const n = seq1.length; const m = seq2.length;
      if (n === 0 || m === 0) return Infinity;
      const dtw = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
      dtw[0][0] = 0;
      for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= m; j++) {
              const cost = Math.hypot(
                  this.angleDiff(seq1[i - 1][0], seq2[j - 1][0]), 
                  this.angleDiff(seq1[i - 1][1], seq2[j - 1][1])
              );
              dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
          }
      }
      return dtw[n][m] / Math.max(n, m);
  }

  private getMedian(arr: number[]): number {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private getProgress(currentKinematics: [number, number]): number {
      const range0 = this.angleDiff(this.refData.target_kinematics[0] as number, this.refData.baseline_kinematics[0] as number);
      const range1 = this.angleDiff(this.refData.target_kinematics[1] as number, this.refData.baseline_kinematics[1] as number);
      
      const primaryIdx = range0 > range1 ? 0 : 1;
      const maxRange = Math.max(range0, range1);
      
      if (maxRange === 0) return 0.0;
      const currentDist = this.angleDiff(currentKinematics[primaryIdx], this.refData.baseline_kinematics[primaryIdx] as number);
      return currentDist / maxRange;
  }

  public processFrame(landmarks: { x: number, y: number, z?: number, visibility?: number }[]): TrackerState {
      if (this.isDiscomfortPaused) return this.getCurrentState();

      const width = 1280; 
      const height = 720;
      
      if (this.flashCounter > 0) this.flashCounter--;
      else this.currentFlashColor = null;

      const getPt = (name: string): Point => {
          const idx = this.landmarkMap[name];
          const lm = landmarks[idx];
          return { x: lm.x * width, y: lm.y * height };
      };

      try {
          const p1 = getPt(this.refData.primary_joint[0]);
          const p2 = getPt(this.refData.primary_joint[1]);
          const p3 = getPt(this.refData.primary_joint[2]);

          const intAngle = this.calculateAngle(p1, p2, p3);
          const vertAngle = this.calculateVerticalAngle(p2, p3);

          if (intAngle > 0 && intAngle < 180) {
              this.historyInternal.push(intAngle);
              if (this.historyInternal.length > 15) this.historyInternal.shift();
          }
          this.historyVertical.push(vertAngle);
          if (this.historyVertical.length > 15) this.historyVertical.shift();

          if (this.historyInternal.length < 5 || this.historyVertical.length < 5) {
              return this.getCurrentState();
          }

          const smoothKinematics: [number, number] = [
              this.getMedian(this.historyInternal),
              this.getMedian(this.historyVertical)
          ];

          if (!this.canStart) {
              const a1 = getPt(this.refData.alignment_points[0]);
              const a2 = getPt(this.refData.alignment_points[1]);
              const bodyAngle = this.calculateAlignmentAngle(a1, a2);

              if (this.angleDiff(bodyAngle, this.refData.reference_alignment_angle) > this.positioningTolerance) {
                  this.canStart = false;
                  const dirStr = bodyAngle > this.refData.reference_alignment_angle ? i18n.t('common.up', "UP") : i18n.t('common.down', "DOWN");
                  this.feedbackMessage = `${i18n.t('workout.feedback.adjustShoulders', 'Adjust shoulders')} ${dirStr}`;
                  this.speakAlert(`${i18n.t('workout.feedback.adjustShoulders', 'Adjust shoulders')} ${dirStr}`);
              } else {
                  const distToStart = Math.hypot(
                      this.angleDiff(smoothKinematics[0], this.refData.baseline_kinematics[0] as number),
                      this.angleDiff(smoothKinematics[1], this.refData.baseline_kinematics[1] as number)
                  );
                  if (distToStart > this.startPoseTolerance) {
                      this.canStart = false;
                      this.feedbackMessage = i18n.t('workout.feedback.returnToStart', "Return to starting position");
                      if (this.isWorkoutActive) this.speakAlert(i18n.t('workout.feedback.returnToStart', "Return to starting position"));
                  } else {
                      this.canStart = true;
                      this.feedbackMessage = i18n.t('workout.feedback.ready', "Ready - Start Exercise");
                  }
              }
          }

          if (this.canStart) {
              if (!this.isWorkoutActive) return this.getCurrentState();

              const progress = this.getProgress(smoothKinematics);

              if (this.state === "WAITING") {
                  this.faultStartTime = null;
                  this.spokenMidRep = false;
                  
                  if (progress > 0.15) {
                      this.state = "OUTBOUND";
                      this.repKinematics = [smoothKinematics];
                      this.currentRepFailed = false;
                      this.failureReason = "";
                      this.feedbackMessage = i18n.t('workout.feedback.movingOutbound', "Moving Outbound...");
                  }
              } else if (this.state === "OUTBOUND" || this.state === "INBOUND") {
                  this.repKinematics.push(smoothKinematics);
                  
                  let minDistToRef = Infinity;
                  for (const refVal of this.refData.reference_sequence) {
                      const dist = Math.hypot(
                          this.angleDiff(smoothKinematics[0], refVal[0]),
                          this.angleDiff(smoothKinematics[1], refVal[1])
                      );
                      if (dist < minDistToRef) minDistToRef = dist;
                  }

                  if (minDistToRef > this.tunnelTolerance && !this.currentRepFailed) {
                      this.currentRepFailed = true;
                      this.failureReason = i18n.t('workout.feedback.formBreak', "Form Break Detected");
                      this.faultStartTime = performance.now();
                      this.spokenMidRep = false;
                      this.feedbackMessage = i18n.t('workout.feedback.repFailed', "REP FAILED - RETURN TO START");
                  }

                  if (this.state === "OUTBOUND" && progress > 0.85) {
                      this.state = "INBOUND";
                      this.feedbackMessage = i18n.t('workout.feedback.movingInbound', "Moving Inbound...");
                  } else if (progress < 0.25 && (this.state === "INBOUND" || this.currentRepFailed)) {
                      this.evaluateCompletedRep();
                  }

                  if (this.currentRepFailed && this.faultStartTime !== null && !this.spokenMidRep) {
                      if ((performance.now() - this.faultStartTime) > 1000) {
                          this.speakAlert(this.failureReason || i18n.t('workout.feedback.incorrectMovement', "Incorrect movement"));
                          this.spokenMidRep = true;
                      }
                  }
              }
          }
      } catch (e) { }
      return this.getCurrentState();
  }

  private evaluateCompletedRep() {
      if (this.repKinematics.length > 10) {
          const dtwDeviation = this.computeDTW(this.repKinematics, this.refData.reference_sequence);
          let qualityScore = Math.max(0, Math.min(100, 100 - (dtwDeviation / this.dtwThreshold) * 50));
          
          let repMaxProgress = 0;
          for (const k of this.repKinematics) {
              const prog = this.getProgress(k);
              if (prog > repMaxProgress) repMaxProgress = prog;
          }

          let isCorrect = true;
          if (this.currentRepFailed) {
              isCorrect = false;
          } else if (repMaxProgress < 0.85) {
              isCorrect = false;
              this.failureReason = i18n.t('workout.feedback.didntExtendFully', "Didn't extend fully to target");
          } else if (dtwDeviation > this.dtwThreshold) {
              isCorrect = false;
              this.failureReason = i18n.t('workout.feedback.jitteryTrajectory', "Jittery or incorrect trajectory");
          }

          this.totalReps++;
          if (isCorrect) {
              this.correctReps++;
              this.feedbackMessage = `${i18n.t('workout.feedback.correct', 'CORRECT!')} ${i18n.t('workout.feedback.quality', 'Quality')}: ${qualityScore.toFixed(0)}`;
              this.speakAlert(i18n.t('workout.feedback.correctVoice', 'Correct'));
              this.flashCounter = 15;
              this.currentFlashColor = "rgba(0, 255, 0, 0.6)"; 
          } else {
              this.wrongReps++;
              this.feedbackMessage = `${i18n.t('workout.feedback.failed', 'FAILED')}: ${this.failureReason}`;
              this.speakAlert(this.failureReason || i18n.t('workout.feedback.incorrectRep', "Incorrect rep"));
              this.flashCounter = 15;
              this.currentFlashColor = "rgba(255, 0, 0, 0.6)"; 
          }

          this.repHistory.push({
              rep_number: this.totalReps,
              quality_score: qualityScore,
              dtw_deviation: dtwDeviation,
              correct: isCorrect,
              failure_reason: this.failureReason
          });
      }
      
      this.state = "WAITING";
      this.repKinematics = [];
      this.currentRepFailed = false;
      this.faultStartTime = null;
      this.spokenMidRep = false;
      this.canStart = false; 
  }

  public getCurrentState(): TrackerState {
      const acc = this.totalReps > 0 ? (this.correctReps / this.totalReps) * 100 : 0;
      return {
          status: this.state,
          canStart: this.canStart,
          currentRepFailed: this.currentRepFailed,
          failureReason: this.failureReason,
          feedbackMessage: this.feedbackMessage,
          totalReps: this.totalReps,
          correctReps: this.correctReps,
          wrongReps: this.wrongReps,
          accuracy: Math.round(acc),
          flashColor: this.currentFlashColor,
          isDiscomfortPaused: this.isDiscomfortPaused,
          painScore: this.currentPainScore
      };
  }
}
// ==========================================
// WORKOUT SCREEN COMPONENT
// ==========================================

export function WorkoutScreen() {
  const { t } = useTranslation();
  const PAIN_TRIGGER_SECONDS = 1.5; 
  const PAIN_SCORE_THRESHOLD = 40;  
  const GESTURE_HOLD_SECONDS = 0.5; 
  const REPS_PER_SET = 4;

  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const customVideoUrl = location.state?.videoUrl;
  
  // DYNAMIC EXERCISE CONFIG STATE
  const [exerciseConfig, setExerciseConfig] = useState<ExerciseConfig | undefined>(undefined);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  
  const [workoutPhase, setWorkoutPhase] = useState<'ALIGNING' | 'COUNTDOWN' | 'EXERCISING' | 'SET_COMPLETED'>('ALIGNING');
  const [countdownVal, setCountdownVal] = useState(3);
  const [showResumeFlash, setShowResumeFlash] = useState(false);
  
  const [trackerUIState, setTrackerUIState] = useState<TrackerState>({
    status: "WAITING", canStart: false, currentRepFailed: false,
    failureReason: "", feedbackMessage: t('common.initializingCamera', "Initializing camera..."),
    totalReps: 0, correctReps: 0, wrongReps: 0, accuracy: 0, flashColor: null,
    isDiscomfortPaused: false, painScore: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const referenceVideoRef = useRef<HTMLVideoElement>(null); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const trackerRef = useRef<PhysioTracker | null>(null);
  const requestRef = useRef<number>();
  
  const durationRef = useRef(0);
  const consecutivePainFramesRef = useRef(0);
  const gestureFramesRef = useRef(0);
  const setCompletedAnnounced = useRef(false);
  const wasFailed = useRef(false);

  const PAIN_POLL_RATE_MS = 200; 
  const PAIN_FRAMES_REQUIRED = Math.ceil((PAIN_TRIGGER_SECONDS * 1000) / PAIN_POLL_RATE_MS);
  const GESTURE_FRAMES_REQUIRED = Math.ceil(GESTURE_HOLD_SECONDS * 45); 

  const currentIndex = EXERCISE_IDS.indexOf(exerciseId || '');
  const hasNextExercise = currentIndex !== -1 && currentIndex + 1 < EXERCISE_IDS.length;

  // --- DYNAMIC EXERCISE FETCHING ---
  useEffect(() => {
      const loadConfig = async () => {
          let config = getExerciseConfig(exerciseId || '');
          if (!config && exerciseId) {
              await fetchCustomExercises();
              config = getExerciseConfig(exerciseId);
          }
          setExerciseConfig(config);
      };
      loadConfig();
  }, [exerciseId]);

  useEffect(() => {
      setIsActive(false);
      setWorkoutPhase('ALIGNING');
      setCompletedAnnounced.current = false;
      wasFailed.current = false;
      setDuration(0);
      durationRef.current = 0;
      consecutivePainFramesRef.current = 0;
      gestureFramesRef.current = 0;
      setCountdownVal(3);
      
      setTrackerUIState({
          status: "WAITING", canStart: false, currentRepFailed: false,
          failureReason: "", feedbackMessage: t('common.initializingCamera', "Initializing camera..."),
          totalReps: 0, correctReps: 0, wrongReps: 0, accuracy: 0, flashColor: null,
          isDiscomfortPaused: false, painScore: 0
      });

      if (referenceVideoRef.current) {
          referenceVideoRef.current.pause();
          referenceVideoRef.current.currentTime = 0;
      }
  }, [exerciseId, t]);

  useEffect(() => {
      if (trackerRef.current) trackerRef.current.isVoiceEnabled = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
      if (trackerRef.current) trackerRef.current.isWorkoutActive = (workoutPhase === 'EXERCISING');
  }, [workoutPhase]);

  useEffect(() => {
      if (workoutPhase === 'ALIGNING' && trackerUIState.canStart && !trackerUIState.currentRepFailed && !trackerUIState.isDiscomfortPaused) {
          setWorkoutPhase('COUNTDOWN');
      } else if (workoutPhase === 'COUNTDOWN' && !trackerUIState.canStart) {
          setWorkoutPhase('ALIGNING');
          getVoiceFeedback().announce(t('workout.feedback.positionLost', "Position lost. Re-align with the yellow guide."));
      }
  }, [workoutPhase, trackerUIState.canStart, trackerUIState.currentRepFailed, trackerUIState.isDiscomfortPaused, t]);

  useEffect(() => {
      let interval: NodeJS.Timeout;

      if (workoutPhase === 'COUNTDOWN') {
          let count = 3;
          setCountdownVal(count);
          getVoiceFeedback().announce(t('workout.feedback.holdPosition', "Hold position. 3"));
          
          interval = setInterval(() => {
              count--;
              if (count > 0) {
                  setCountdownVal(count);
                  getVoiceFeedback().announce(count.toString());
              } else {
                  clearInterval(interval);
                  setWorkoutPhase('EXERCISING');
                  getVoiceFeedback().announce(t('workout.feedback.go', "Go!"));
                  if (referenceVideoRef.current) referenceVideoRef.current.play(); 
              }
          }, 1000);
      }
      
      return () => {
          if (interval) clearInterval(interval);
      };
  }, [workoutPhase, t]);

  useEffect(() => {
      if (trackerUIState.currentRepFailed && !wasFailed.current) {
          wasFailed.current = true;
          if (referenceVideoRef.current) {
              referenceVideoRef.current.pause();
              referenceVideoRef.current.currentTime = 0;
          }
      } else if (!trackerUIState.currentRepFailed && wasFailed.current && trackerUIState.canStart) {
          wasFailed.current = false;
          if (workoutPhase === 'EXERCISING') {
              getVoiceFeedback().announce(t('workout.feedback.resume', "Resume"));
              setShowResumeFlash(true);
              setTimeout(() => setShowResumeFlash(false), 1500);
              if (referenceVideoRef.current) referenceVideoRef.current.play();
          }
      }
  }, [trackerUIState.currentRepFailed, trackerUIState.canStart, workoutPhase, t]);

  useEffect(() => {
      if (trackerUIState.correctReps >= REPS_PER_SET && workoutPhase !== 'SET_COMPLETED' && !setCompletedAnnounced.current) {
          setCompletedAnnounced.current = true;
          setWorkoutPhase('SET_COMPLETED');
          if (referenceVideoRef.current) referenceVideoRef.current.pause();
          
          const audioInstruction = hasNextExercise 
              ? t('workout.feedback.setCompleted', "Set completed. Excellent work! Please select an option on screen to continue.") 
              : t('workout.feedback.workoutCompleted', "Workout completed. Excellent work! Please select view summary.");
          getVoiceFeedback().announce(audioInstruction);
      }
  }, [trackerUIState.correctReps, workoutPhase, hasNextExercise, t]);

  useEffect(() => {
    const loadFaceModels = async () => {
      try {
        const MODEL_URL = '/models'; 
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        setFaceModelsLoaded(true);
      } catch (err) {}
    };
    loadFaceModels();
  }, []);

  useEffect(() => {
    const initVision = async () => {
      if (!exerciseConfig?.referenceData) return;
      
      trackerRef.current = new PhysioTracker(exerciseConfig.referenceData);
      trackerRef.current.isVoiceEnabled = voiceEnabled;

      try {
          const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
          poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task", delegate: "GPU" },
              runningMode: "VIDEO", numPoses: 1
          });
      } catch (err) {}
    };
    initVision();
    
    return () => {
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [exerciseConfig, voiceEnabled]);

  useEffect(() => {
    if (!isActive || isPaused || !faceModelsLoaded || trackerUIState.isDiscomfortPaused || workoutPhase === 'SET_COMPLETED') return;

    const interval = setInterval(async () => {
        if (videoRef.current && trackerRef.current && !trackerRef.current.isDiscomfortPaused) {
            try {
                if (videoRef.current.videoWidth === 0) return;

                const detections = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
                
                if (detections) {
                    const ex = detections.expressions;
                    const fear = ex.fearful || 0;
                    const disgust = ex.disgusted || 0;
                    const sad = ex.sad || 0;
                    
                    const painScore = (fear + disgust + sad) * 100;
                    
                    trackerRef.current.latestFaceBox = detections.detection.box;
                    trackerRef.current.latestPainScore = painScore;

                    if (painScore >= PAIN_SCORE_THRESHOLD) { 
                        consecutivePainFramesRef.current += 1;
                        if (consecutivePainFramesRef.current >= PAIN_FRAMES_REQUIRED) {
                            trackerRef.current.isDiscomfortPaused = true;
                            trackerRef.current.currentPainScore = painScore;
                            trackerRef.current.speakAlert(t('workout.feedback.discomfortDetected', "I noticed you might be in discomfort. Are you alright? Please show a thumbs up to continue, or a thumbs down to stop the workout."), true);
                            if (referenceVideoRef.current) referenceVideoRef.current.pause(); 
                            
                            setTrackerUIState(trackerRef.current.getCurrentState());
                            consecutivePainFramesRef.current = 0; 
                        }
                    } else {
                        consecutivePainFramesRef.current = 0;
                    }
                } else {
                    trackerRef.current.latestFaceBox = null;
                    consecutivePainFramesRef.current = 0;
                }
            } catch (e) { }
        }
    }, PAIN_POLL_RATE_MS); 

    return () => clearInterval(interval);
  }, [isActive, isPaused, faceModelsLoaded, trackerUIState.isDiscomfortPaused, PAIN_FRAMES_REQUIRED, PAIN_SCORE_THRESHOLD, workoutPhase, t]);

  const handlePainResume = useCallback(() => {
      if (trackerRef.current) {
          trackerRef.current.isDiscomfortPaused = false;
          trackerRef.current.currentPainScore = 0;
          trackerRef.current.speakAlert(t('workout.feedback.resumingExercise', "Resuming exercise."), true);
          gestureFramesRef.current = 0;
          if (referenceVideoRef.current && workoutPhase === 'EXERCISING') referenceVideoRef.current.play(); 
          setTrackerUIState(trackerRef.current.getCurrentState());
      }
  }, [workoutPhase, t]);

  const handleStop = useCallback(async () => {
    setIsActive(false);
    getVoiceFeedback().stop();

    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    const tracker = trackerRef.current;
    const finalState = tracker ? tracker.getCurrentState() : null;

    if (!user) return;

    const sessionData: SessionSummary = {
      id: crypto.randomUUID(), 
      patientId: user.id,
      exerciseId: exerciseId || 'unknown',
      exerciseName: exerciseConfig?.name || 'Unknown Exercise',
      timestamp: new Date().toISOString(),
      duration: durationRef.current,
      total_reps: finalState?.totalReps || 0,
      correct_reps: finalState?.correctReps || 0,
      wrong_reps: finalState?.wrongReps || 0,
      accuracy: finalState?.accuracy || 0,
      repHistory: tracker?.repHistory || [],
      synced: false 
    };

    await handleExerciseCompletion(sessionData);

    // Map new config to old legacy format for Summary Screen compat
    const mappedExercise = exerciseConfig ? {
        id: exerciseConfig.id,
        name: exerciseConfig.name,
        description: exerciseConfig.description,
        videoUrl: customVideoUrl,
        steps: exerciseConfig.instructions,
        precautions: exerciseConfig.postureCues
    } : null;

    navigate('/workout-summary', { 
      state: { metrics: sessionData, exercise: mappedExercise }
    });
  }, [navigate, exerciseConfig, exerciseId, user, customVideoUrl]);

  const handleNextExercise = useCallback(() => {
      if (hasNextExercise) {
          const nextId = EXERCISE_IDS[currentIndex + 1];
          const currentPath = window.location.pathname;
          navigate(currentPath.replace(exerciseId as string, nextId));
      }
  }, [hasNextExercise, currentIndex, exerciseId, navigate]);

  const processVideo = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || !trackerRef.current || isPaused) {
      requestRef.current = requestAnimationFrame(processVideo);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const tracker = trackerRef.current;
    const startTimeMs = performance.now();
    
    try {
      if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const results = poseLandmarkerRef.current.detectForVideo(video, startTimeMs);
          let drawColor = "rgb(0, 255, 255)"; 
              
          if (results.landmarks && results.landmarks.length > 0) {
              const landmarks = results.landmarks[0];

              if (tracker.isDiscomfortPaused) {
                  drawColor = "rgba(255, 100, 100, 0.6)"; 
                  
                  const { isUp, isDown, activePoint } = detectGesture(landmarks);

                  if (isUp || isDown) {
                      gestureFramesRef.current++;
                      const progress = Math.min(1, gestureFramesRef.current / GESTURE_FRAMES_REQUIRED);

                      if (activePoint) {
                          const tx = activePoint.x * canvas.width;
                          const ty = activePoint.y * canvas.height;
                          
                          ctx.beginPath(); ctx.arc(tx, ty, 60, 0, 2 * Math.PI); ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fill();
                          ctx.beginPath(); ctx.arc(tx, ty, 60, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * progress));
                          ctx.strokeStyle = isUp ? "#00ff00" : "#ff0000"; ctx.lineWidth = 15; ctx.lineCap = "round"; ctx.stroke();
                      }

                      if (gestureFramesRef.current >= GESTURE_FRAMES_REQUIRED) {
                          if (isUp) handlePainResume(); else handleStop();
                      }
                  } else {
                      gestureFramesRef.current = 0; 
                  }
              } 
              else {
                  const state = tracker.processFrame(landmarks);
                  drawColor = state.currentRepFailed ? "rgb(255, 0, 0)" : (state.canStart ? "rgb(0, 255, 0)" : "rgb(0, 255, 255)");
                  
                  if ((!state.canStart || state.currentRepFailed) && exerciseConfig?.referenceData) {
                      const landmarkMap: Record<string, number> = {
                          'LEFT_SHOULDER': 11, 'RIGHT_SHOULDER': 12, 'LEFT_ELBOW': 13, 'RIGHT_ELBOW': 14,
                          'LEFT_WRIST': 15, 'RIGHT_WRIST': 16, 'LEFT_HIP': 23, 'RIGHT_HIP': 24
                      };
                      
                      const p1Idx = landmarkMap[exerciseConfig.referenceData.primary_joint[0]]; 
                      const p2Idx = landmarkMap[exerciseConfig.referenceData.primary_joint[1]]; 
                      const p3Idx = landmarkMap[exerciseConfig.referenceData.primary_joint[2]]; 

                      const p2 = landmarks[p2Idx];
                      const p3 = landmarks[p3Idx];
                      const wrist = landmarks[landmarkMap['RIGHT_WRIST']];

                      if (p2 && p3) {
                          const joint1X = p2.x * canvas.width; const joint1Y = p2.y * canvas.height;
                          const length1 = Math.hypot((p3.x - p2.x) * canvas.width, (p3.y - p2.y) * canvas.height);
                          const primaryAngle = (exerciseConfig.referenceData.baseline_kinematics[1] as number) * (Math.PI / 180);
                          
                          const target1X = joint1X + length1 * Math.cos(primaryAngle); const target1Y = joint1Y + length1 * Math.sin(primaryAngle);

                          ctx.beginPath(); ctx.strokeStyle = "rgba(255, 255, 0, 0.4)"; ctx.lineWidth = 20; ctx.lineCap = "round";
                          ctx.moveTo(joint1X, joint1Y); ctx.lineTo(target1X, target1Y); ctx.stroke(); 
                          ctx.beginPath(); ctx.fillStyle = "rgba(255, 255, 0, 0.7)"; ctx.arc(target1X, target1Y, 15, 0, 2 * Math.PI); ctx.fill();

                          if (wrist) {
                              const length2 = Math.hypot((wrist.x - p3.x) * canvas.width, (wrist.y - p3.y) * canvas.height);
                              let target2X = target1X; let target2Y = target1Y; let drawSecondSegment = false;

                              if (exerciseConfig.id === 'wall-slides') {
                                  const forearmAngle = -Math.PI / 2;
                                  target2X = target1X + length2 * Math.cos(forearmAngle); target2Y = target1Y + length2 * Math.sin(forearmAngle);
                                  drawSecondSegment = true;
                              } else if (exerciseConfig.id === 'side-raises' || exerciseConfig.id === 'front-raises') { 
                                  target2X = target1X + length2 * Math.cos(primaryAngle); target2Y = target1Y + length2 * Math.sin(primaryAngle);
                                  drawSecondSegment = true;
                              }

                              if (drawSecondSegment) {
                                  ctx.beginPath(); ctx.strokeStyle = "rgba(255, 255, 0, 0.4)"; ctx.lineWidth = 16; ctx.lineCap = "round";
                                  ctx.moveTo(target1X, target1Y); ctx.lineTo(target2X, target2Y); ctx.stroke(); 
                                  ctx.beginPath(); ctx.fillStyle = "rgba(255, 255, 0, 0.7)"; ctx.arc(target2X, target2Y, 12, 0, 2 * Math.PI); ctx.fill();
                                  ctx.fillStyle = "yellow"; ctx.font = "bold 20px sans-serif"; ctx.fillText(`${t('workout.startHere', 'START HERE')} \u2190`, target2X + 20, target2Y);
                              } else {
                                  ctx.fillStyle = "yellow"; ctx.font = "bold 20px sans-serif"; ctx.fillText(`${t('workout.startHere', 'START HERE')} \u2190`, target1X + 20, target1Y);
                              }
                          }
                      }
                  }

                  if (state.canStart && exerciseConfig?.referenceData) {
                      const landmarkMap: Record<string, number> = {
                          'LEFT_SHOULDER': 11, 'RIGHT_SHOULDER': 12, 'LEFT_ELBOW': 13, 'RIGHT_ELBOW': 14,
                          'LEFT_WRIST': 15, 'RIGHT_WRIST': 16, 'LEFT_HIP': 23, 'RIGHT_HIP': 24
                      };
                      
                      const anchorIdx = landmarkMap[exerciseConfig.referenceData.primary_joint[1]]; 
                      const targetIdx = landmarkMap[exerciseConfig.referenceData.primary_joint[2]]; 

                      const anchor = landmarks[anchorIdx];
                      const target = landmarks[targetIdx];

                      if (anchor && target) {
                          const aX = anchor.x * canvas.width, aY = anchor.y * canvas.height;
                          const tX = target.x * canvas.width, tY = target.y * canvas.height;
                          const length = Math.hypot(tX - aX, tY - aY);
                          const seq = exerciseConfig.referenceData.reference_sequence;

                          if (length > 10 && seq.length > 0) {
                              const pts = seq.map(r => {
                                  const t = r[1] * (Math.PI / 180);
                                  return { x: aX + length * Math.cos(t), y: aY + length * Math.sin(t) };
                              });

                              ctx.beginPath(); ctx.strokeStyle = "rgb(200, 200, 200)"; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
                              pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                              ctx.stroke(); ctx.setLineDash([]); 
                              ctx.beginPath(); ctx.fillStyle = "rgb(255, 165, 0)"; ctx.arc(pts[0].x, pts[0].y, 6, 0, 2 * Math.PI); ctx.fill();
                              ctx.beginPath(); ctx.fillStyle = "rgb(0, 255, 0)"; ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 8, 0, 2 * Math.PI); ctx.fill();
                          }
                      }
                  }
              }

              const upperBodyIndices = [11, 12, 13, 14, 15, 16, 23, 24, 19, 20, 21, 22]; 
              const connections = [
                  [11, 12], [11, 23], [12, 24], [23, 24], 
                  [11, 13], [13, 15], [12, 14], [14, 16],
                  [15, 21], [15, 19], [16, 22], [16, 20] 
              ];

              ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = drawColor;
              connections.forEach(([sIdx, eIdx]) => {
                  const s = landmarks[sIdx], e = landmarks[eIdx];
                  if (s && e) { ctx.moveTo(s.x * canvas.width, s.y * canvas.height); ctx.lineTo(e.x * canvas.width, e.y * canvas.height); }
              });
              ctx.stroke();

              upperBodyIndices.forEach(idx => {
                  const lm = landmarks[idx];
                  if (lm) {
                      const x = lm.x * canvas.width, y = lm.y * canvas.height;
                      ctx.beginPath(); ctx.fillStyle = drawColor; ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.fill();
                  }
              });
          }

          if (tracker.latestFaceBox && tracker.latestPainScore > 0) {
              const box = tracker.latestFaceBox;
              const scaleX = canvas.width / video.videoWidth; const scaleY = canvas.height / video.videoHeight;
              const bx = box.x * scaleX; const by = box.y * scaleY; const bw = box.width * scaleX; const bh = box.height * scaleY;
              const isPain = tracker.latestPainScore >= PAIN_SCORE_THRESHOLD;
              const boxColor = isPain ? "rgb(255, 0, 0)" : "rgb(0, 255, 0)"; 
              
              ctx.beginPath(); ctx.strokeStyle = boxColor; ctx.lineWidth = 3; ctx.rect(bx, by, bw, bh); ctx.stroke();
              ctx.fillStyle = boxColor; ctx.font = "bold 18px monospace";
              ctx.fillText(isPain ? `${t('workout.discomfort', 'DISCOMFORT')} (${tracker.latestPainScore.toFixed(0)}%)` : `${t('workout.comfortable', 'Comfortable')} (${tracker.latestPainScore.toFixed(0)}%)`, bx, by - 10);

              if (isPain && !tracker.isDiscomfortPaused) {
                  const fillWidth = (consecutivePainFramesRef.current / PAIN_FRAMES_REQUIRED) * bw;
                  ctx.fillStyle = "red"; ctx.fillRect(bx, by + bh + 5, fillWidth, 8);
              }
          }

          const newState = tracker.getCurrentState();
          setTrackerUIState(prevState => {
              if (
                  prevState.totalReps !== newState.totalReps || 
                  prevState.feedbackMessage !== newState.feedbackMessage ||
                  prevState.status !== newState.status ||
                  prevState.canStart !== newState.canStart ||
                  prevState.currentRepFailed !== newState.currentRepFailed ||
                  prevState.flashColor !== newState.flashColor ||
                  prevState.isDiscomfortPaused !== newState.isDiscomfortPaused
              ) return newState;
              return prevState;
          });

          ctx.restore();
      }
    } catch (err) { }
    requestRef.current = requestAnimationFrame(processVideo);
  }, [isPaused, exerciseConfig, handlePainResume, handleStop, PAIN_FRAMES_REQUIRED, PAIN_SCORE_THRESHOLD, GESTURE_FRAMES_REQUIRED, workoutPhase, t]);

  useEffect(() => {
    if (!isActive || isPaused || !startTime || trackerUIState.isDiscomfortPaused || workoutPhase === 'SET_COMPLETED') return;
    const interval = setInterval(() => {
        const newDur = Math.floor((Date.now() - startTime) / 1000);
        setDuration(newDur); durationRef.current = newDur;
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, isPaused, startTime, trackerUIState.isDiscomfortPaused, workoutPhase]);

  useEffect(() => {
    let streamToCleanUp: MediaStream | null = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (isActive && !isPaused) { 
      navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }).then((stream) => {
          streamToCleanUp = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => {
                requestRef.current = requestAnimationFrame(processVideo);
            }).catch(e => console.error("Play error:", e));
          }
        }).catch((err) => console.error("Webcam error:", err));
    }
    return () => {
        if (streamToCleanUp) streamToCleanUp.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPaused]); 

  const handleStart = () => { 
      setIsActive(true); 
      setStartTime(Date.now()); 
      getVoiceFeedback().announce(t('workout.startingExercise', `Starting {{name}}. Please follow the yellow marking to get into the starting position.`, { name: t(`exercises.${exerciseConfig?.id}.name`, exerciseConfig?.name) })); 
  };
  const handlePause = () => { setIsPaused(true); if (referenceVideoRef.current) referenceVideoRef.current.pause(); };
  const handleAppResume = () => { setIsPaused(false); if (startTime) setStartTime(Date.now() - durationRef.current * 1000); if (workoutPhase === 'EXERCISING' && referenceVideoRef.current) referenceVideoRef.current.play(); };
  const toggleVoice = () => setVoiceEnabled(!voiceEnabled);
  const formatDuration = (seconds: number) => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs.toString().padStart(2, '0')}`; };

  if (!exerciseConfig) return <div className="min-h-screen flex items-center justify-center bg-background"><p>{t('workout.exerciseNotFound', 'Exercise not found')}</p></div>;

  if (!isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl w-full">
          <Card className="p-8">
            <h2 className="text-2xl mb-4">{t(`exercises.${exerciseConfig.id}.name`, exerciseConfig.name)}</h2>
            <p className="text-muted-foreground mb-6">{t(`exercises.${exerciseConfig.id}.description`, exerciseConfig.description)}</p>
            <div className="space-y-6 mb-8">
              <div>
                <h3 className="mb-3">{t('workout.instructionsTitle', 'Instructions')}</h3>
                <ol className="space-y-2">{exerciseConfig.instructions.map((ins, i) => (<li key={i} className="flex gap-3 text-sm"><span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm">{i + 1}</span>{t(`exercises.${exerciseConfig.id}.instruction${i}`, ins)}</li>))}</ol>
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={handleStart} className="flex-1 h-12 bg-primary"><Camera className="w-5 h-5 mr-2" /> {t('workout.startBtn', 'Start Exercise')}</Button>
              <Button onClick={() => navigate('/start-workout')} variant="outline" className="h-12">{t('common.cancel', 'Cancel')}</Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-30 transition-all duration-75" style={{ border: trackerUIState.flashColor ? `15px solid ${trackerUIState.flashColor}` : '0px solid transparent' }} />

      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100 z-10" width={1280} height={720} />

      <AnimatePresence>
          {workoutPhase === 'COUNTDOWN' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <motion.span 
                      key={countdownVal} 
                      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} 
                      className="text-[15rem] font-bold text-green-500 drop-shadow-[0_0_30px_rgba(0,255,0,0.8)]"
                  >
                      {countdownVal}
                  </motion.span>
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {showResumeFlash && (
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
                  <span className="text-6xl font-bold text-green-500 drop-shadow-[0_0_20px_rgba(0,255,0,0.8)] tracking-widest uppercase">{t('workout.resume', 'RESUME')}</span>
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {workoutPhase === 'SET_COMPLETED' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md border-8 border-green-600">
               <CheckCircle className="text-green-500 w-24 h-24 mb-4" />
               <h1 className="text-6xl font-bold text-green-500 mb-2 drop-shadow-2xl text-center uppercase">{t('workout.setCompletedTitle', 'SET COMPLETED')}</h1>
               <p className="text-2xl text-white font-semibold mb-8 text-center uppercase">{t('workout.setCompletedSub', `Great job! You finished {{count}} reps.`, { count: REPS_PER_SET })}</p>

               <div className="flex gap-6 mt-4">
                   {hasNextExercise && <Button onClick={handleNextExercise} size="lg" className="bg-green-600 hover:bg-green-500 h-16 px-8 text-xl rounded-2xl">{t('workout.nextExerciseBtn', 'Next Exercise')}</Button>}
                   <Button onClick={handleStop} size="lg" variant="destructive" className="h-16 px-8 text-xl rounded-2xl">{t('workout.viewSummaryBtn', 'View Summary')}</Button>
               </div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {trackerUIState.isDiscomfortPaused && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm border-8 border-red-600">
               <AlertTriangle className="text-red-500 w-24 h-24 mb-4 animate-pulse" />
               <h1 className="text-6xl font-bold text-red-500 mb-2 drop-shadow-2xl text-center uppercase">{t('workout.pausedTitle', 'PAUSED')}</h1>
               <p className="text-2xl text-white font-semibold mb-8 text-center uppercase">{t('workout.areYouAlright', 'Are you alright?')}</p>
               
               <div className="bg-red-900/50 border border-red-500/50 px-6 py-3 rounded-full mb-8">
                   <p className="text-red-300 font-mono">{t('workout.painScore', 'PAIN SCORE')}: {trackerUIState.painScore.toFixed(0)}%</p>
               </div>

               <div className="flex gap-12 mb-12 bg-white/10 p-6 rounded-2xl border border-white/20 shadow-2xl">
                   <div className="flex flex-col items-center">
                       <ThumbsUp className="w-16 h-16 text-green-400 mb-3" />
                       <span className="text-white text-lg font-medium">{t('workout.showThumbsUp', 'Show Thumbs UP')}</span>
                       <span className="text-white/60 text-sm">{t('workout.toResume', 'to resume workout')}</span>
                   </div>
                   <div className="w-px bg-white/20 h-full"></div>
                   <div className="flex flex-col items-center">
                       <ThumbsDown className="w-16 h-16 text-red-400 mb-3" />
                       <span className="text-white text-lg font-medium">{t('workout.showThumbsDown', 'Show Thumbs DOWN')}</span>
                       <span className="text-white/60 text-sm">{t('workout.toStop', 'to stop workout')}</span>
                   </div>
               </div>

               <div className="flex gap-6 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                   <Button onClick={handlePainResume} size="lg" className="bg-green-600 hover:bg-green-500">{t('workout.resume', 'Resume')}</Button>
                   <Button onClick={handleStop} size="lg" variant="destructive">{t('common.stop', 'Stop')}</Button>
               </div>
           </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-6 left-6 flex flex-col gap-4 z-20 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 w-48 text-center">
            <p className="text-white/60 text-sm mb-1 uppercase tracking-wider">{t('common.time', 'Time')}</p>
            <p className="text-white font-mono text-3xl">{formatDuration(duration)}</p>
        </div>
        <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex gap-6 text-center w-48 justify-center">
            <div>
                <p className="text-white/60 text-sm mb-1">{t('common.reps', 'REPS')}</p>
                <p className="text-white font-mono text-2xl">{trackerUIState.correctReps}/{REPS_PER_SET}</p>
            </div>
            <div>
                <p className="text-white/60 text-sm mb-1">{t('common.accuracyAbbr', 'ACC.')}</p>
                <p className="text-[#00ff00] font-mono text-2xl">{trackerUIState.accuracy}%</p>
            </div>
        </div>
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
         <div className={`px-6 py-3 rounded-full text-lg font-medium shadow-2xl transition-colors duration-300 ${trackerUIState.currentRepFailed ? 'bg-red-500 text-white' : (trackerUIState.status === "OUTBOUND" || trackerUIState.status === "INBOUND" ? 'bg-blue-600 text-white' : 'bg-white/95 text-black')}`}>
             {workoutPhase === 'ALIGNING' ? t('workout.alignWithGuide', "Align with Yellow Guide") : trackerUIState.feedbackMessage}
         </div>
      </div>

      <div className="absolute top-6 right-6 w-64 h-48 bg-gray-900 rounded-2xl border-2 border-white/20 overflow-hidden shadow-2xl z-20 hidden md:block">
        <video 
          ref={referenceVideoRef}
          src={customVideoUrl || exerciseConfig?.referenceData?.videoUrl || "/reference-video.mp4"}
          loop 
          muted 
          playsInline 
          className="w-full h-full object-cover" 
        />
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider">{t('workout.idealReference', 'Ideal Reference')}</div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        <Button onClick={isPaused ? handleAppResume : handlePause} size="lg" variant={isPaused ? 'default' : 'secondary'} className="rounded-2xl h-14 px-6">
          {isPaused ? <><Play className="w-5 h-5 mr-2" /> {t('workout.resume', 'Resume')}</> : <><Pause className="w-5 h-5 mr-2" /> {t('workout.pause', 'Pause')}</>}
        </Button>
        <Button onClick={toggleVoice} size="lg" variant="secondary" className="rounded-2xl h-14 px-6">
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
        <Button onClick={handleStop} size="lg" variant="destructive" className="rounded-2xl h-14 px-6">
          <StopCircle className="w-5 h-5 mr-2" /> {t('common.stop', 'Stop')}
        </Button>
      </div>

    </div>
  );
}