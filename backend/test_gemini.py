import os
import traceback
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
key = os.getenv('GEMINI_API_KEY')
print('KEY:', repr(key))

if not key:
    print('No key found')
    exit(1)

genai.configure(api_key=key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    response = model.generate_content('hello')
    print('Response:', response.text)
except Exception as e:
    print("Caught Exception:")
    traceback.print_exc()
