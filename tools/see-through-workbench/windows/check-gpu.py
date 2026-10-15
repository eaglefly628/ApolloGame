"""Check actual GPU computation, not just whether the torch package imports."""
import json
from pathlib import Path
import torch
import torchvision
import torchaudio

if not torch.cuda.is_available():
    raise SystemExit('CUDA is unavailable. Check NVIDIA driver and that the cu128 PyTorch wheel installed successfully.')
if torch.__version__.split('+')[0] != '2.8.0' or torch.version.cuda != '12.8':
    raise SystemExit(f'Unexpected PyTorch/CUDA combination: {torch.__version__} / {torch.version.cuda}')
properties = torch.cuda.get_device_properties(0)
x = torch.ones((256, 256), device='cuda', dtype=torch.bfloat16)
result = x @ x
torch.cuda.synchronize()
if float(result[0, 0].cpu()) != 256:
    raise SystemExit('GPU compute smoke check failed.')
report = {'gpu': properties.name, 'vramGiB': round(properties.total_memory / 1024**3, 2), 'torch': torch.__version__, 'torchvision': torchvision.__version__, 'torchaudio': torchaudio.__version__, 'cudaRuntime': torch.version.cuda, 'bf16Matmul': 'passed'}
path = Path(__file__).resolve().parent.parent / 'workspace/gpu-check.json'
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
