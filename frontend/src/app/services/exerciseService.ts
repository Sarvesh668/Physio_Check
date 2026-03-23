import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFirestoreDb } from '../config/firebase';
import { ExerciseConfig, registerDynamicExercises } from '../config/exerciseConfigs';

// Point to the Flask backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface GenerateExercisePayload {
    name: string;
    description: string;
    instructions: string[];
    posture_cues: string[];
    video_url: string;
    primary_joints: string[];
    alignment_joints: string[];
    physio_id: string;
    side: 'left' | 'right' | 'both';
}

/**
 * Sends video and joint data to Flask Backend for DTW processing.
 */
export const generateCustomExercise = async (payload: GenerateExercisePayload) => {
    try {
        const response = await fetch(`${API_URL}/api/exercises/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to generate exercise');
        }

        return await response.json();
    } catch (error) {
        console.error("Generate Custom Exercise Error:", error);
        throw error;
    }
};

/**
 * Fetches generated exercises from Firestore and registers them in the frontend cache.
 */
export const fetchCustomExercises = async (physioId?: string) => {
    try {
        // FIX: Safely assign 'db' using your imported getFirestoreDb
        const db = typeof getFirestoreDb === 'function' ? getFirestoreDb() : getFirestoreDb;

        const customRef = collection(db as any, 'custom_exercises');
        
        // If physioId is provided, filter by it. Otherwise, fetch all.
        const q = physioId 
            ? query(customRef, where('physio_id', '==', physioId)) 
            : customRef;
            
        const snapshot = await getDocs(q);
        const configs: ExerciseConfig[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as ExerciseConfig;
            configs.push(data);
        });

        // Inject the fetched dynamic exercises into our static dictionary
        if (configs.length > 0) {
            registerDynamicExercises(configs);
        }

        return configs;
    } catch (error) {
        console.error("Error fetching custom exercises:", error);
        return [];
    }
};