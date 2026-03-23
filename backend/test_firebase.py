from db import db
import datetime

print("\n3. Attempting to write test data to Firestore...")
try:
    db.collection('system_tests').document('ping').set({
        'status': 'Online!',
        'time': datetime.datetime.now()
    })
    print("\n✅ SUCCESS! FIREBASE IS FULLY CONNECTED AND WORKING!")
except Exception as e:
    print(f"\n❌ FAILED TO WRITE: {e}")