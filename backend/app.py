import firebase_admin
from firebase_admin import credentials, firestore
import os
from db import db, create_chat, send_message, get_messages
from dotenv import load_dotenv

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

import uuid

# --- NEW IMPORT FOR PHASE 1 ---
from services.kinematics import generate_exercise_config

app = Flask(__name__)

# UPDATED: Explicitly allow all origins, methods, and headers so Vercel can send JSON POST requests
CORS(app, resources={r"/*": {"origins": "*"}}, methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])

@app.route('/signup', methods=['POST'])
def signup():
    try:
        # 1. Move the data loading INSIDE the try block so it catches any JSON formatting errors
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

        name = data.get('name')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role')

        if not all([name, email, password, role]):
            return jsonify({"error": "Missing required fields"}), 400

        # 2. Check if user already exists
        users_ref = db.collection('users')
        query = users_ref.where('email', '==', email).limit(1).get()
        
        if len(query) > 0:
            return jsonify({"error": "Email already exists"}), 409
        
        # 3. Hash password
        hashed_password = generate_password_hash(password)
        
        # 4. Create new user document
        user_id = str(uuid.uuid4())
        user_data = {
            'id': user_id,
            'name': name,
            'email': email,
            'password': hashed_password,
            'role': role,
            'physio_id': None,
            'onboarded': False
        }
        
        users_ref.document(user_id).set(user_data)
        
        # 5. Return success response
        return jsonify({
            "message": "User created successfully", 
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "physio_id": None,
                "onboarded": False
            }
        }), 201

    except Exception as e:
        print(f"Signup error: {e}")
        # This guarantees that even if it fails, it sends a proper error with CORS headers back to Vercel!
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({"error": "Missing email or password"}), 400

    try:
        # Fetch user by email
        users_ref = db.collection('users')
        query = users_ref.where('email', '==', email).limit(1).get()
        
        if not query:
             return jsonify({"error": "Invalid credentials"}), 401
             
        user_doc = query[0]
        user_data = user_doc.to_dict()
        
        if user_data and check_password_hash(user_data['password'], password):
            return jsonify({
                "message": "Login successful", 
                "user": {
                    "id": user_data['id'], 
                    "name": user_data['name'], 
                    "email": user_data['email'],
                    "role": user_data.get('role'),
                    "physio_id": user_data.get('physio_id'),
                    "onboarded": user_data.get('onboarded', False)
                }
            }), 200
        else:
            return jsonify({"error": "Invalid credentials"}), 401

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/profile/update', methods=['POST'])
def update_profile():
    data = request.get_json()
    user_id = data.get('id')
    name = data.get('name')
    email = data.get('email')

    if not user_id:
        return jsonify({"error": "Missing user ID"}), 400

    try:
        user_ref = db.collection('users').document(user_id)
        update_data = {}
        if name:
            update_data['name'] = name
        if email:
            update_data['email'] = email
        
        if not update_data:
            return jsonify({"error": "No data to update"}), 400

        user_ref.update(update_data)
        
        # Fetch updated user
        updated_doc = user_ref.get()
        user_data = updated_doc.to_dict()
        
        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": user_data['id'],
                "name": user_data['name'],
                "email": user_data['email'],
                "role": user_data.get('role'),
                "physio_id": user_data.get('physio_id'),
                "onboarded": user_data.get('onboarded', False)
            }
        }), 200

    except Exception as e:
        print(f"Profile update error: {e}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/physiotherapists', methods=['GET'])
def get_physiotherapists():
    try:
        users_ref = db.collection('users')
        query = users_ref.where('role', '==', 'physiotherapist').get()
        
        physios = []
        for doc in query:
            user_data = doc.to_dict()
            physios.append({
                "id": user_data['id'],
                "name": user_data['name'],
                "email": user_data['email']
            })
            
        return jsonify({"physiotherapists": physios}), 200
    except Exception as e:
        print(f"Error fetching physiotherapists: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/link-physio', methods=['POST'])
def link_physio():
    data = request.get_json()
    patient_id = data.get('patient_id')
    physio_id = data.get('physio_id')
    
    if not all([patient_id, physio_id]):
        return jsonify({"error": "Missing patient_id or physio_id"}), 400
        
    try:
        patient_ref = db.collection('users').document(patient_id)
        patient_ref.update({"physio_id": physio_id})
        
        return jsonify({"message": "Physiotherapist linked successfully"}), 200
    except Exception as e:
        print(f"Error linking physiotherapist: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/patient/onboarding', methods=['POST'])
def patient_onboarding():
    data = request.get_json()
    user_id = data.get('user_id')
    onboarding_data = {
        'name': data.get('name'),
        'age': data.get('age'),
        'referred_by': data.get('referred_by'),
        'height': data.get('height'),
        'weight': data.get('weight'),
        'reason': data.get('reason'),
        'timestamp': firestore.SERVER_TIMESTAMP
    }

    if not user_id or not all(onboarding_data.values()):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        db.collection('patients').document(user_id).set(onboarding_data)
        # Also mark user as onboarded in users collection
        db.collection('users').document(user_id).update({'onboarded': True})
        return jsonify({"message": "Onboarding completed successfully"}), 201
    except Exception as e:
        print(f"Onboarding error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/patient/onboarding/<user_id>', methods=['GET'])
def get_patient_onboarding(user_id):
    try:
        doc = db.collection('patients').document(user_id).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        else:
            return jsonify({"error": "Patient not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/physiotherapist/patients/<physio_id>', methods=['GET'])
def get_physio_patients(physio_id):
    try:
        # Get all users who have this physio_id
        users_ref = db.collection('users')
        query = users_ref.where('role', '==', 'patient').where('physio_id', '==', physio_id).get()
        
        patients = []
        for doc in query:
            user_data = doc.to_dict()
            # Also fetch onboarding data
            onboarding_doc = db.collection('patients').document(user_data['id']).get()
            onboarding_data = onboarding_doc.to_dict() if onboarding_doc.exists else {}
            
            patients.append({
                "id": user_data['id'],
                "name": user_data['name'],
                "email": user_data['email'],
                "onboarding": onboarding_data
            })
            
        return jsonify({"patients": patients}), 200
    except Exception as e:
        print(f"Error fetching physio patients: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/physiotherapist/assign-exercises', methods=['POST'])
def assign_exercises():
    data = request.get_json()
    patient_id = data.get('patient_id')
    physio_id = data.get('physio_id')
    exercises = data.get('exercises') # List of { name, video_url }

    if not all([patient_id, physio_id, exercises]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        assignment_ref = db.collection('assigned_exercises').document(patient_id)
        assignment_ref.set({
            'patient_id': patient_id,
            'physio_id': physio_id,
            'exercises': exercises,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"message": "Exercises assigned successfully"}), 200
    except Exception as e:
        print(f"Error assigning exercises: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/patient/assigned-exercises/<patient_id>', methods=['GET'])
def get_assigned_exercises(patient_id):
    try:
        doc = db.collection('assigned_exercises').document(patient_id).get()
        if doc.exists:
            return jsonify(doc.to_dict()), 200
        else:
            return jsonify({"exercises": []}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ----------------- LIVE CHAT ROUTES -----------------

@app.route("/chat/create", methods=["POST"])
def api_create_chat():
    data = request.get_json()
    patient_id = data.get("patient_id")
    physio_id = data.get("physio_id")
    
    if not all([patient_id, physio_id]):
        return jsonify({"error": "Missing patient_id or physio_id"}), 400
    
    chat_id = create_chat(patient_id, physio_id)
    return jsonify({"chat_id": chat_id}), 201

@app.route("/chat/send", methods=["POST"])
def api_send_message():
    data = request.get_json()
    chat_id = data.get("chat_id")
    sender_id = data.get("sender_id")
    text = data.get("text")
    msg_type = data.get("type", "text")
    
    if not all([chat_id, sender_id, text]):
        return jsonify({"error": "Missing required fields"}), 400
    
    message_id = send_message(chat_id, sender_id, text, msg_type)
    return jsonify({"message_id": message_id}), 201

@app.route("/chat/messages/<chat_id>", methods=["GET"])
def api_get_messages(chat_id):
    try:
        messages = get_messages(chat_id)
        return jsonify({"messages": messages}), 200
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return jsonify({"error": str(e)}), 500


# ----------------- NEW: DYNAMIC EXERCISE GENERATOR -----------------

@app.route('/api/exercises/generate', methods=['POST'])
def generate_custom_exercise():
    data = request.get_json()

    # Extract all parameters sent from the new Physiotherapist UI
    video_url = data.get('video_url')
    exercise_name = data.get('name')
    description = data.get('description', '')
    instructions = data.get('instructions', [])
    posture_cues = data.get('posture_cues', [])
    primary_joints = data.get('primary_joints')  # e.g., ["RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST"]
    alignment_joints = data.get('alignment_joints')  # e.g., ["LEFT_SHOULDER", "RIGHT_SHOULDER"]
    physio_id = data.get('physio_id')
    side = data.get('side', 'right')

    if not all([video_url, exercise_name, primary_joints, alignment_joints, physio_id]):
        return jsonify({"error": "Missing required fields for processing"}), 400

    try:
        # Run the OpenCV/MediaPipe Processing Script
        reference_data = generate_exercise_config(
            video_url=video_url,
            exercise_name=exercise_name,
            primary_joints=primary_joints,
            alignment_joints=alignment_joints
        )

        # Structure the final document
        exercise_id = str(uuid.uuid4())
        exercise_doc = {
            "id": exercise_id,
            "name": exercise_name,
            "description": description,
            "instructions": instructions,
            "postureCues": posture_cues,
            "side": side,
            "physio_id": physio_id,
            "videoUrl": video_url,
            "primaryJoint": {
                "label": f"Custom {side.capitalize()} Side Tracking"
            },
            "referenceData": reference_data,
            "created_at": firestore.SERVER_TIMESTAMP
        }

        # Save to a central custom_exercises collection
        db.collection('custom_exercises').document(exercise_id).set(exercise_doc)

        return jsonify({
            "message": "Exercise analyzed and generated successfully",
            "exercise_id": exercise_id
        }), 201

    except Exception as e:
        print(f"Error generating exercise: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)