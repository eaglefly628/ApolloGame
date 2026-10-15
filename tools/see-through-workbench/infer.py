"""Run the preserved See-through pipeline in a compatible Python environment."""
import argparse
import os
from pathlib import Path
import subprocess
import shutil
import sys

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'workspace/layerdiff_output')
    parser.add_argument('--resolution', type=int, default=1280)
    parser.add_argument('--resolution-depth', type=int, help='Depth resolution; Mac defaults to the image resolution, CUDA keeps native 768.')
    parser.add_argument('--group-offload', action='store_true')
    parser.add_argument('--device', choices=['auto', 'cuda', 'mps'], default='auto')
    args = parser.parse_args()
    image = args.image.resolve()
    if not image.is_file():
        parser.error(f'Input image does not exist: {image}')
    try:
        import torch
    except ImportError:
        parser.exit(2, 'See-through requires its own Python environment. Follow vendor/see-through/README.md; no inference has run.\n')
    device = args.device
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else None
    if device == 'cuda' and not torch.cuda.is_available() or device == 'mps' and not torch.backends.mps.is_available() or device is None:
        parser.exit(2, 'No requested GPU backend available. Use the Windows CUDA environment, Mac Apple-silicon MPS environment, or the official demo. No inference has run.\n')
    if device == 'mps' and args.group_offload:
        parser.error('Upstream group offload is not verified for MPS. Use lower resolution on Mac.')
    native = Path(__file__).parent / 'vendor/see-through'
    assets = native / 'assets'
    if not assets.exists():
        if os.name == 'nt':
            shutil.copytree(native / 'common/assets', assets)
        else:
            assets.symlink_to('common/assets', target_is_directory=True)
    env = dict(os.environ)
    env['PYTHONUNBUFFERED'] = '1'
    # Standard HTTP resumes cached files and gives reliable byte progress across
    # local proxies; model bytes and inference algorithms are unchanged.
    env.setdefault('HF_HUB_DISABLE_XET', '1')
    env.setdefault('HF_HOME', str((Path(__file__).parent / 'workspace/hf-cache').resolve()))
    env['PYTHONPATH'] = str(native / 'common') + os.pathsep + env.get('PYTHONPATH', '')
    launcher = str((Path(__file__).parent / 'macos/run-mps.py').resolve()) if device == 'mps' else 'inference/scripts/inference_psd.py'
    if device == 'mps':
        env['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
    cmd = [sys.executable, launcher, '--srcp', str(image), '--save_dir', str(args.output.resolve()), '--resolution', str(args.resolution), '--save_to_psd']
    depth_resolution = args.resolution_depth if args.resolution_depth is not None else args.resolution if device == 'mps' else 768
    cmd += ['--resolution_depth', str(depth_resolution)]
    if args.group_offload:
        cmd.append('--group_offload')
    return subprocess.call(cmd, cwd=native, env=env)

if __name__ == '__main__':
    sys.exit(main())
