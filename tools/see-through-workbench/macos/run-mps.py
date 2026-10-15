"""Adapt the native inference device at import time; never edit vendored files."""
import importlib.abc
import importlib.util
from pathlib import Path
import runpy
import sys
import torch

native = Path(__file__).resolve().parent.parent / 'vendor/see-through'

class NativeDeviceAdapter(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, fullname, path=None, target=None):
        paths = {'utils.inference_utils': 'utils/inference_utils.py', 'modules.layerdiffuse.vae': 'modules/layerdiffuse/vae.py'}
        if fullname in paths:
            return importlib.util.spec_from_loader(fullname, self, origin=str(native / 'common' / paths[fullname]))
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        path = Path(module.__spec__.origin)
        source = path.read_text(encoding='utf-8')
        # Pin exact anchor counts so an upstream change cannot silently skip the
        # adaptation. All model code, PSD logic, seeds and BF16 precision remain.
        if module.__name__ == 'utils.inference_utils':
            if source.count("device='cuda'") != 6 or source.count("enable_group_offload('cuda'") != 2:
                raise RuntimeError('Native CUDA anchors changed; review the MPS adapter before running.')
            source = source.replace("device='cuda'", "device='mps'").replace("enable_group_offload('cuda'", "enable_group_offload('mps'")
        else:
            # MPS aborts (rather than raising a fallback exception) on this 5D
            # median. Evaluate the identical reduction on CPU and return its
            # values to the original device; no decoder/model logic is changed.
            anchor = 'median = torch.median(result, dim=0).values'
            if source.count(anchor) != 1:
                raise RuntimeError('Native transparent decoder median anchor changed.')
            source = source.replace(anchor, 'median = torch.median(result.cpu(), dim=0).values.to(result.device)')
        module.__file__ = str(path)
        exec(compile(source, str(path), 'exec'), module.__dict__)
        if module.__name__ == 'utils.inference_utils':
            original_depth = module.apply_marigold
            def run_depth(*args, **kwargs):
                # The next stage consumes exported PNGs, so retain no finished
                # layer model in unified memory while allocating the depth model.
                module.layerdiff_pipeline = None
                module.gc.collect()
                torch.mps.empty_cache()
                print('[mac] released completed layer model before depth stage', flush=True)
                return original_depth(*args, **kwargs)
            module.apply_marigold = run_depth

if __name__ == '__main__':
    if not torch.backends.mps.is_available():
        raise SystemExit('MPS GPU unavailable: use Apple silicon and the Mac PyTorch environment.')
    # Verify this OS/PyTorch combination supports the native BF16 arithmetic.
    test = torch.ones((2, 2), device='mps', dtype=torch.bfloat16)
    test @ test
    torch.mps.synchronize()
    sys.meta_path.insert(0, NativeDeviceAdapter())
    sys.path.insert(0, str(native / 'common'))
    runpy.run_path(str(native / 'inference/scripts/inference_psd.py'), run_name='__main__')
