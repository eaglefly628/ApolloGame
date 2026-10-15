"""Verified parallel HTTP resume into the standard Hugging Face cache."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import os
from pathlib import Path
import shutil
import threading
import time
import requests
from huggingface_hub import HfApi
from filelock import FileLock

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='layerdifforg/seethroughv0.0.2_layerdiff3d')
    parser.add_argument('--file', default='unet/diffusion_pytorch_model.safetensors')
    parser.add_argument('--revision', default='4477e6ce529bc6a141732e1a55a4932176db3b89')
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--ignore-prefix', action='store_true', help='Refetch all bytes while preserving the existing prefix until verification succeeds.')
    args = parser.parse_args()
    workbench = Path(__file__).resolve().parent.parent
    hub = workbench / 'workspace/hf-cache/hub'
    info = HfApi().model_info(args.repo, revision=args.revision, files_metadata=True)
    metadata = next(f for f in info.siblings if f.rfilename == args.file)
    if not metadata.lfs:
        raise SystemExit('This resume helper only accepts an official SHA256-addressed model blob.')
    sha, size = metadata.lfs.sha256, metadata.size
    cache = hub / ('models--' + args.repo.replace('/', '--'))
    blob = cache / 'blobs' / sha
    partial = blob.with_name(sha + '.incomplete')
    parts = workbench / 'workspace/download-parts' / sha
    parts.mkdir(parents=True, exist_ok=True)
    blob.parent.mkdir(parents=True, exist_ok=True)
    if blob.exists():
        raise SystemExit('Model blob already present; let the native loader use it.')
    # Share the native Hub lock: no loader may resume this blob while its
    # prefix is being assembled and verified.
    lock = hub / '.locks' / cache.name / (sha + '.lock')
    lock.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(lock)):
        download_blob(args, info, sha, size, blob, partial, parts, cache)

def download_blob(args, info, sha, size, blob, partial, parts, cache):
    if blob.exists():
        print('Model completed by another loader while waiting for the native cache lock.', flush=True)
        return
    start = partial.stat().st_size if partial.exists() and not args.ignore_prefix else 0
    if start > size:
        raise SystemExit('Cached prefix larger than official model; refusing to overwrite it.')
    chunk = 64 * 1024 * 1024
    ranges = [(offset, min(size - 1, offset + chunk - 1)) for offset in range(start, size, chunk)]
    source = f'https://huggingface.co/{args.repo}/resolve/{args.revision}/{args.file}'
    local = threading.local()
    def fetch_segment(bounds):
        first, last = bounds
        file = parts / f'{first}-{last}.part'
        expected = last - first + 1
        if file.exists() and file.stat().st_size == expected:
            return file
        if not hasattr(local, 'session'):
            local.session = requests.Session()
        for attempt in range(3):
            try:
                with local.session.get(source, headers={'Range': f'bytes={first}-{last}'}, stream=True, timeout=(30, 120)) as response:
                    response.raise_for_status()
                    if response.status_code != 206 or response.headers.get('Content-Range') != f'bytes {first}-{last}/{size}':
                        raise RuntimeError('Model server did not honour the exact byte range; refusing unverified assembly.')
                    temporary = file.with_suffix('.tmp')
                    received = 0
                    with temporary.open('wb') as target:
                        for block in response.iter_content(1024 * 1024):
                            target.write(block)
                            received += len(block)
                    if received != expected:
                        raise RuntimeError('Incomplete range response')
                    temporary.replace(file)
                    return file
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(2 * (attempt + 1))
    completed = start
    began = time.monotonic()
    print(f'Resuming {start / 1024**3:.2f} / {size / 1024**3:.2f} GiB; official SHA256 {sha}', flush=True)
    with ThreadPoolExecutor(max_workers=max(1, min(16, args.workers))) as executor:
        futures = {executor.submit(fetch_segment, bounds): bounds for bounds in ranges}
        for future in as_completed(futures):
            file = future.result()
            completed += file.stat().st_size
            print(f'{completed / 1024**3:.2f} / {size / 1024**3:.2f} GiB verified-range data; {time.monotonic()-began:.0f}s', flush=True)
    joined = parts / 'joined.tmp'
    if start:
        shutil.copyfile(partial, joined)
    else:
        joined.write_bytes(b'')
    with joined.open('ab') as target:
        for first, last in ranges:
            with (parts / f'{first}-{last}.part').open('rb') as source_file:
                shutil.copyfileobj(source_file, target, 4 * 1024 * 1024)
    digest = hashlib.sha256()
    with joined.open('rb') as source_file:
        for block in iter(lambda: source_file.read(4 * 1024 * 1024), b''):
            digest.update(block)
    if joined.stat().st_size != size or digest.hexdigest() != sha:
        joined.unlink()
        for file in parts.glob('*.part'):
            file.unlink()
        raise SystemExit('Final model SHA256 mismatch. Download segments discarded; native cache and original prefix preserved. Rerun to fetch fresh segments, or use --ignore-prefix if the mismatch repeats.')
    joined.replace(blob)
    target = cache / 'snapshots' / info.sha / args.file
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.symlink_to(os.path.relpath(blob, target.parent))
    if partial.exists():
        partial.unlink()
    for file in parts.glob('*.part'):
        file.unlink()
    print('PASS: complete model matches official SHA256 and is ready in the native cache.', flush=True)

if __name__ == '__main__':
    main()
