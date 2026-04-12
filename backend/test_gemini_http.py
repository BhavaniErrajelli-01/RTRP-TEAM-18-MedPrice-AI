import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

def test_gemini(model_name):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": "Hello"}]}]
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res = response.read().decode('utf-8')
            print(f"[{model_name}] SUCCESS")
    except Exception as e:
        print(f"[{model_name}] ERROR: {e}")
        try:
            print("Response:", e.read().decode('utf-8'))
        except:
            pass

test_gemini("gemini-1.5-flash")
test_gemini("gemini-2.5-flash")
test_gemini("gemini-2.0-flash")
