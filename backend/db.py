import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

# FORCE the absolute path to the key in the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
key_path = os.path.join(current_dir, 'serviceAccountKey.json')

print(f"Attempting to load Firebase key from EXACT path: {key_path}")

if not firebase_admin._apps:
    # If the file is missing or broken, this will now intentionally crash and tell us exactly why
    try:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase initialized successfully with the forced local key.")
    except Exception as e:
        print(f"❌ CRITICAL FIREBASE INIT ERROR: {e}")

db = firestore.client()

# ----------------- LIVE CHAT FUNCTIONS -----------------
def get_chat_id(patient_id, physio_id):
    """Generate a consistent chat ID by sorting participant IDs"""
    ids = sorted([patient_id, physio_id])
    return f"chat_{ids[0]}_{ids[1]}"

def create_chat(patient_id, physio_id):
    """Create or get a chat room between patient and physiotherapist"""
    chat_id = get_chat_id(patient_id, physio_id)
    chat_ref = db.collection("chats").document(chat_id)
    
    doc = chat_ref.get()
    if not doc.exists:
        chat_ref.set({
            "id": chat_id,
            "participants": [patient_id, physio_id],
            "lastUpdated": datetime.now(timezone.utc)
        })
    return chat_id

def send_message(chat_id, sender_id, text, msg_type="text"):
    """Send a message in a chat room"""
    message_ref = db.collection("chats").document(chat_id).collection("messages").document()
    message_ref.set({
        "senderId": sender_id,
        "text": text,
        "type": msg_type,
        "timestamp": datetime.now(timezone.utc),  # timezone-aware UTC
        "readBy": []
    })
    # Update chat's lastUpdated timestamp
    db.collection("chats").document(chat_id).update({"lastUpdated": datetime.now(timezone.utc)})
    return message_ref.id

def get_messages(chat_id, limit=50):
    """Fetch the last messages of a chat room"""
    messages_ref = db.collection("chats").document(chat_id).collection("messages") \
                     .order_by("timestamp").limit_to_last(limit)
    return [msg.to_dict() for msg in messages_ref.stream()]