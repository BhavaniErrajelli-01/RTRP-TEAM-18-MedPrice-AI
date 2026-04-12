import urllib.request
import json

try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/search?query=dolo")
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
