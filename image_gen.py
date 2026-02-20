import os
import io
import sys
import requests
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
HF_MODEL = os.getenv("HF_MODEL", "black-forest-labs/FLUX.1-schnell")

def generate_image(prompt, filename):
    print(f"Generating image for prompt: '{prompt}' using {HF_MODEL}...")
    
    # VERIFIED WORKING URL (Feb 2026)
    URL = f"https://router.huggingface.co/hf-inference/models/{HF_MODEL}"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    
    try:
        response = requests.post(URL, headers=headers, json={"inputs": prompt}, timeout=60)
        
        if response.status_code != 200:
            print(f"API Error: {response.status_code} - {response.text}")
            return None
            
        image_bytes = response.content
        image = Image.open(io.BytesIO(image_bytes))
        
        # Ensure output directory exists
        output_dir = "public/images"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        full_path = os.path.join(output_dir, filename).replace('\\', '/')
        image.save(full_path)
        print(f"Success! Image saved to: {full_path}")
        return full_path
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python image_gen.py '<prompt>' <filename.webp>")
        sys.exit(1)
        
    prompt = sys.argv[1]
    filename = sys.argv[2]
    
    # Auto-append extension if missing
    if not filename.endswith(('.webp', '.png', '.jpg')):
        filename += ".webp"
        
    generate_image(prompt, filename)
