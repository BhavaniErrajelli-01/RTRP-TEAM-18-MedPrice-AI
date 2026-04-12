import httpx
try:
    r = httpx.post('http://127.0.0.1:8000/api/chat', json={'messages': [{'role': 'user', 'content': 'test'}]})
    print("STATUS:", r.status_code)
    print("BODY:", r.text)
except Exception as e:
    print("ERROR:", e)
