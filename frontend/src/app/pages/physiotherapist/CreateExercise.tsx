import React, { useState } from 'react';
import { generateCustomExercise } from '../../services/exerciseService';
import { cloudinaryConfig } from '../../config/cloudinary'; // Added Cloudinary config
import { useAuth } from '../../context/AuthContext'; // Added Auth to get physio ID
import { toast } from 'sonner';

const AVAILABLE_JOINTS = [
  "LEFT_SHOULDER", "RIGHT_SHOULDER", 
  "LEFT_ELBOW", "RIGHT_ELBOW",
  "LEFT_WRIST", "RIGHT_WRIST", 
  "LEFT_HIP", "RIGHT_HIP",
  "LEFT_KNEE", "RIGHT_KNEE", 
  "LEFT_ANKLE", "RIGHT_ANKLE"
];

export default function CreateExercise() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [side, setSide] = useState<'left' | 'right' | 'both'>('right');
  const [instructions, setInstructions] = useState<string[]>(['', '', '']);
  const [postureCues, setPostureCues] = useState<string[]>(['']);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [primaryJoints, setPrimaryJoints] = useState<string[]>([]);
  const [alignmentJoints, setAlignmentJoints] = useState<string[]>([]);
  
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleListChange = (index: number, value: string, list: string[], setList: Function) => {
    const newList = [...list];
    newList[index] = value;
    setList(newList);
  };
  const addListItem = (list: string[], setList: Function) => setList([...list, '']);
  const removeListItem = (index: number, list: string[], setList: Function) => setList(list.filter((_, i) => i !== index));

  const toggleJoint = (joint: string, type: 'primary' | 'alignment') => {
    if (type === 'primary') {
      if (primaryJoints.includes(joint)) setPrimaryJoints(primaryJoints.filter(j => j !== joint));
      else if (primaryJoints.length < 3) setPrimaryJoints([...primaryJoints, joint]);
    } else {
      if (alignmentJoints.includes(joint)) setAlignmentJoints(alignmentJoints.filter(j => j !== joint));
      else if (alignmentJoints.length < 2) setAlignmentJoints([...alignmentJoints, joint]);
    }
  };

  // Your proven Cloudinary upload logic
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const { cloudName, uploadPreset } = cloudinaryConfig;
    if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration missing");

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('resource_type', 'video');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Cloudinary upload failed');
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return setErrorMessage("Please upload a reference video.");
    if (primaryJoints.length !== 3) return setErrorMessage("Please select exactly 3 primary joints.");
    if (alignmentJoints.length !== 2) return setErrorMessage("Please select exactly 2 alignment joints.");
    if (!user?.id) return setErrorMessage("Authentication error. Physio ID not found.");

    try {
      setStatus('uploading');
      toast.info("Uploading reference video to cloud...");
      
      // 1. Upload the real video
      const videoUrl = await uploadToCloudinary(videoFile);

      setStatus('processing');
      toast.info("Generating AI DTW Tracking Model. This may take 10-20 seconds...");
      
      // 2. Send to Flask Backend
      await generateCustomExercise({
        name,
        description,
        instructions: instructions.filter(i => i.trim() !== ''),
        posture_cues: postureCues.filter(c => c.trim() !== ''),
        video_url: videoUrl,
        primary_joints: primaryJoints,
        alignment_joints: alignmentJoints,
        physio_id: user.id,
        side
      });

      setStatus('success');
      toast.success("Exercise generated successfully!");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "An error occurred.");
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center mt-20 bg-green-50 rounded-xl border border-green-200">
        <h2 className="text-2xl font-bold text-green-700 mb-4">Exercise Created!</h2>
        <p className="text-gray-600 mb-6">The DTW model has been generated and saved to the database. It is now ready to be assigned to patients.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Create Another</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-sm rounded-xl mb-20 mt-10 border border-gray-100">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Create Custom AI Exercise</h1>
      
      {errorMessage && <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-lg border border-red-200">{errorMessage}</div>}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Basic Details */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">1. Basic Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="e.g., Bicep Curl" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Side</label>
              <select value={side} onChange={e => setSide(e.target.value as any)} className="w-full p-2 border rounded-md">
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded-md" rows={2}></textarea>
          </div>
        </section>

        {/* Text Steps (Instructions & Cues) */}
        <section className="grid grid-cols-2 gap-8">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Step-by-step Instructions</label>
                {instructions.map((inst, index) => (
                    <input key={index} type="text" value={inst} onChange={e => handleListChange(index, e.target.value, instructions, setInstructions)} className="w-full p-2 border rounded-md mb-2 text-sm" placeholder={`Step ${index + 1}`} />
                ))}
                <button type="button" onClick={() => addListItem(instructions, setInstructions)} className="text-xs text-indigo-600 font-medium">+ Add Step</button>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice Feedback Cues (Mistakes to avoid)</label>
                {postureCues.map((cue, index) => (
                    <input key={index} type="text" value={cue} onChange={e => handleListChange(index, e.target.value, postureCues, setPostureCues)} className="w-full p-2 border rounded-md mb-2 text-sm" placeholder={`Cue ${index + 1}`} />
                ))}
                <button type="button" onClick={() => addListItem(postureCues, setPostureCues)} className="text-xs text-indigo-600 font-medium">+ Add Cue</button>
            </div>
        </section>

        {/* Video Upload */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">2. Reference Video</h2>
          <p className="text-sm text-gray-500">Upload a perfect repetition. The backend will extract kinematics to build the DTW tunnel.</p>
          <input type="file" required accept="video/mp4,video/webm,video/quicktime" onChange={e => setVideoFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
        </section>

        {/* Interactive Picker */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">3. Tracking Model Builder</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <h3 className="font-semibold text-indigo-800 mb-2">Primary Tracking Joints ({primaryJoints.length}/3)</h3>
              <p className="text-xs text-indigo-600 mb-4">Select exactly 3 joints that form the main angle of movement (e.g., Shoulder, Elbow, Wrist).</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_JOINTS.map(joint => (
                  <button 
                    key={`p-${joint}`} type="button" 
                    onClick={() => toggleJoint(joint, 'primary')}
                    className={`text-xs p-2 rounded border transition-colors ${primaryJoints.includes(joint) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {joint.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h3 className="font-semibold text-emerald-800 mb-2">Posture Alignment Joints ({alignmentJoints.length}/2)</h3>
              <p className="text-xs text-emerald-600 mb-4">Select 2 joints to track body alignment & stability (e.g., Left Shoulder & Right Shoulder).</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_JOINTS.map(joint => (
                  <button 
                    key={`a-${joint}`} type="button" 
                    onClick={() => toggleJoint(joint, 'alignment')}
                    className={`text-xs p-2 rounded border transition-colors ${alignmentJoints.includes(joint) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {joint.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="pt-6 border-t">
          <button 
            type="submit" 
            disabled={status === 'uploading' || status === 'processing'}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:bg-gray-400 transition-colors flex justify-center items-center"
          >
            {status === 'idle' || status === 'error' ? 'Generate DTW Tracking Model' : 
             status === 'uploading' ? '1. Uploading Video to Cloud...' : 
             '2. Analyzing Kinematics (Please Wait)...'}
          </button>
        </div>
      </form>
    </div>
  );
}