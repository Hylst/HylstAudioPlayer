import os
import requests
from dotenv import load_dotenv

load_dotenv()
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_MODEL = os.getenv("HF_MODEL", "black-forest-labs/FLUX.1-schnell")

url = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"
headers = {"Authorization": f"Bearer {HF_API_KEY}"}
prompt = "Cyberpunk neon icon"

print(f"Final Test on: {url}")
try:
    response = requests.post(url, headers=headers, json={"inputs": prompt})
    print(f"Status Code: {response.status_code}")
    print("Response Headers:")
    for k, v in response.headers.items():
        print(f"  {k}: {v}")
    print(f"Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
