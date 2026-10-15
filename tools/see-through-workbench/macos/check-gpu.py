import json
from pathlib import Path
import platform
import torch

if not torch.backends.mps.is_available():
    raise SystemExit('Apple MPS GPU unavailable. This package requires a compatible Apple-silicon Mac.')
x = torch.ones((128, 128), device='mps', dtype=torch.bfloat16)
value = x @ x
generator = torch.Generator(device='mps').manual_seed(0)
torch.randn((4,), generator=generator, device='mps')
torch.mps.synchronize()
if float(value[0, 0].cpu()) != 128:
    raise SystemExit('MPS computation failed.')
report = {'platform': platform.platform(), 'torch': torch.__version__, 'backend': 'mps', 'bf16Matmul': 'passed', 'mpsGenerator': 'passed', 'fullInference': 'not-established-by-this-check'}
destination = Path(__file__).resolve().parent.parent / 'workspace/mac-gpu-check.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
