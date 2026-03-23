import cv2
import numpy as np
from scipy.signal import savgol_filter
import urllib.request
import os

# --- Modern Tasks API ---
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# 1. Automatically download the required AI Model
TASK_PATH = "pose_landmarker.task"
if not os.path.exists(TASK_PATH):
    print("Downloading MediaPipe Pose Model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task", 
        TASK_PATH
    )

# 2. Initialize the AI Detector
base_options = python.BaseOptions(model_asset_path=TASK_PATH)
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_poses=1
)
detector = vision.PoseLandmarker.create_from_options(options)

POSE_LANDMARKS = {
    "NOSE": 0, "LEFT_EYE_INNER": 1, "LEFT_EYE": 2, "LEFT_EYE_OUTER": 3,
    "RIGHT_EYE_INNER": 4, "RIGHT_EYE": 5, "RIGHT_EYE_OUTER": 6,
    "LEFT_EAR": 7, "RIGHT_EAR": 8, "MOUTH_LEFT": 9, "MOUTH_RIGHT": 10,
    "LEFT_SHOULDER": 11, "RIGHT_SHOULDER": 12, "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14, "LEFT_WRIST": 15, "RIGHT_WRIST": 16,
    "LEFT_PINKY": 17, "RIGHT_PINKY": 18, "LEFT_INDEX": 19,
    "RIGHT_INDEX": 20, "LEFT_THUMB": 21, "RIGHT_THUMB": 22,
    "LEFT_HIP": 23, "RIGHT_HIP": 24, "LEFT_KNEE": 25,
    "RIGHT_KNEE": 26, "LEFT_ANKLE": 27, "RIGHT_ANKLE": 28,
    "LEFT_HEEL": 29, "RIGHT_HEEL": 30, "LEFT_FOOT_INDEX": 31,
    "RIGHT_FOOT_INDEX": 32
}

def calculate_angle(p1, p2, p3):
    v1 = np.array([p1[0] - p2[0], p1[1] - p2[1]])
    v2 = np.array([p3[0] - p2[0], p3[1] - p2[1]])
    dot = np.dot(v1, v2)
    mag1 = np.linalg.norm(v1)
    mag2 = np.linalg.norm(v2)
    if mag1 < 1e-6 or mag2 < 1e-6: return 90.0
    cos_angle = np.clip(dot / (mag1 * mag2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))

def calculate_vertical_angle(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return float(np.degrees(np.arctan2(dy, dx)))

def calculate_alignment_angle(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    if abs(dx) < 1e-6: return 90.0
    return float(abs(np.degrees(np.arctan2(dy, dx))))

def get_pt(lm, idx, w, h):
    return [lm[idx].x * w, lm[idx].y * h]

def generate_exercise_config(video_url, exercise_name, primary_joints, alignment_joints):
    p1_idx = POSE_LANDMARKS[primary_joints[0]]
    p2_idx = POSE_LANDMARKS[primary_joints[1]]
    p3_idx = POSE_LANDMARKS[primary_joints[2]]
    a1_idx = POSE_LANDMARKS[alignment_joints[0]]
    a2_idx = POSE_LANDMARKS[alignment_joints[1]]

    cap = cv2.VideoCapture(video_url)
    raw_sequence = []
    alignment_vals = []
    current_timestamp_ms = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break

        current_timestamp_ms += 33
        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = detector.detect_for_video(mp_image, current_timestamp_ms)

        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            continue

        lm = result.pose_landmarks[0]

        # CHANGE A: Extremely low visibility threshold (0.1)
        if any(lm[idx].visibility < 0.1 for idx in [p1_idx, p2_idx, p3_idx, a1_idx, a2_idx]):
            continue

        pt1, pt2, pt3 = get_pt(lm, p1_idx, w, h), get_pt(lm, p2_idx, w, h), get_pt(lm, p3_idx, w, h)
        align1, align2 = get_pt(lm, a1_idx, w, h), get_pt(lm, a2_idx, w, h)

        raw_sequence.append([calculate_angle(pt1, pt2, pt3), calculate_vertical_angle(pt2, pt3)])
        alignment_vals.append(calculate_alignment_angle(align1, align2))

    cap.release()

    # CHANGE B: Lowered minimum frames to 5
    if len(raw_sequence) < 5:
        raise ValueError("AI could not detect the selected joints clearly. Please ensure you are visible and use the side closest to camera.")

    sequence = np.array(raw_sequence)

    # CHANGE C: Dynamic Smoothing Window
    if len(sequence) >= 3:
        # Window must be odd and less than the data length
        window = min(7, len(sequence))
        if window % 2 == 0: window -= 1
        if window >= 3:
            sequence[:, 0] = savgol_filter(sequence[:, 0], window, 2)
            sequence[:, 1] = savgol_filter(sequence[:, 1], window, 2)

    def resample(seq, target_len=100):
        x_old = np.linspace(0, 1, len(seq))
        x_new = np.linspace(0, 1, target_len)
        return np.array([np.interp(x_new, x_old, seq[:, i]) for i in range(seq.shape[1])]).T

    sequence = resample(sequence)
    baseline = sequence[0].tolist()
    target = sequence[np.argmin(sequence[:, 0])].tolist()
    
    return {
        "exercise_name": exercise_name,
        "primary_joint": primary_joints,
        "alignment_points": alignment_joints,
        "baseline_kinematics": baseline,
        "target_kinematics": target,
        "movement_range": float(np.max(sequence[:, 0]) - np.min(sequence[:, 0])),
        "reference_alignment_angle": float(np.mean(alignment_vals)) if alignment_vals else 0.0,
        "referenceData": [{"joint_angle": float(r[0]), "vertical_angle": float(r[1])} for r in sequence]
    }