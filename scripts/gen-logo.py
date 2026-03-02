"""
gen-logo.py — Generate Gymbo logo candidates using FLUX.1-dev on GT1.

Run on GT1 (2× GPU, 24GB VRAM):
  ssh gt1 "mkdir -p ~/gymbo-logo-gen && cd ~/gymbo-logo-gen && python gen-logo.py"

Then pull candidates back to this repo:
  scp 'gt1:~/gymbo-logo-gen/candidates/*.png' ./public/logo-candidates/

Review, pick the best, copy to:
  public/logo-mark.png   ← icon (nav, hero, footer)

Then update index.astro logo-mark.svg references to logo-mark.png if preferred.
"""

from diffusers import FluxPipeline
import torch, os

pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",  # ~24GB VRAM; swap to FLUX.1-schnell if OOM
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()  # handles VRAM headroom automatically
pipe.to("cuda")

prompt = """
Gymbo fitness app logo. A bold minimalist clenched fist icon centered inside a rounded
pill/capsule shape. Flat vector illustration style, no gradients, no drop shadows, no text.
Dark charcoal background (#1a1a1a) on the pill. Clean light lines for the fist (#ebebe6).
Single orange accent stroke #f8623a. Simple geometric shapes, modern, ultra-bold.
White canvas background. Isolated logo mark, 512x512, high contrast, crisp edges.
"""

images = pipe(
    prompt=prompt,
    num_inference_steps=28,      # dev model
    guidance_scale=3.5,
    num_images_per_prompt=4,     # 4 candidates
    height=512,
    width=512,
).images

os.makedirs("candidates", exist_ok=True)
for i, img in enumerate(images):
    out = f"candidates/logo-{i}.png"
    img.save(out)
    print(f"saved {out}")

print("done — review candidates/ and scp best to gymbo-landing/public/logo-mark.png")
