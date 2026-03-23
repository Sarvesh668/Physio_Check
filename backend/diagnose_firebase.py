import urllib.request
import json
import datetime
import json as json_lib

def check_time_drift():
    print("\n--- 1. CHECKING SYSTEM TIME VS INTERNET TIME ---")
    try:
        # Fetch true UTC time from the internet
        res = urllib.request.urlopen("http://worldtimeapi.org/api/timezone/Etc/UTC", timeout=5)
        data = json.loads(res.read())
        
        internet_time = datetime.datetime.fromtimestamp(data['unixtime'], datetime.timezone.utc)
        local_time = datetime.datetime.now(datetime.timezone.utc)
        
        drift_seconds = (local_time - internet_time).total_seconds()
        
        print(f"Internet UTC Time: {internet_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Local PC UTC Time: {local_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Time Drift: {abs(drift_seconds):.2f} seconds")
        
        if abs(drift_seconds) > 60:
            print("❌ WARNING: YOUR CLOCK IS DESYNCED BY MORE THAN 60 SECONDS!")
            print("Google Firebase STRICTLY requires your clock to be perfect, or it throws 'Invalid JWT Signature'.")
        else:
            print("✅ SYSTEM TIME IS PERFECTLY SYNCED. Time is NOT the issue.")
            
    except Exception as e:
        print(f"Could not reach time server: {e}")

def check_key_format():
    print("\n--- 2. CHECKING KEY FILE FORMAT ---")
    try:
        with open("serviceAccountKey.json", "r") as f:
            key_data = json_lib.load(f)
            
        if key_data.get("type") != "service_account":
            print("❌ WARNING: This doesn't look like a Service Account Key!")
            print("Did you accidentally download the 'Web API Key' instead of the 'Service Account Key'?")
        elif "private_key" not in key_data:
            print("❌ WARNING: The 'private_key' field is missing from your JSON file!")
        else:
            print("✅ KEY JSON STRUCTURE IS VALID.")
            
    except json_lib.JSONDecodeError:
        print("❌ WARNING: serviceAccountKey.json is corrupted! It is not valid JSON.")
    except FileNotFoundError:
        print("❌ WARNING: serviceAccountKey.json not found in this folder!")

check_time_drift()
check_key_format()
print("\n")