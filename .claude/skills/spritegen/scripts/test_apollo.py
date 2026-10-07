"""Offline integration tests with geometric fixtures, never production artwork."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parents[3]

class ApolloPipeline(unittest.TestCase):
    def call(self, script, *args, ok=True):
        p = subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)], capture_output=True, text=True)
        self.assertEqual(p.returncode == 0, ok, p.stdout + p.stderr)
        return p

    def test_prepare_slice_preview_export(self):
        with tempfile.TemporaryDirectory(prefix="apollo-spritegen-smoke-") as temp:
            root = Path(temp)
            run = root / "run"
            self.call("prepare_sprite_run.py", "--name", "test geometry only", "--kind", "animation", "--concept", "QA fixture, not character art", "--grid", "2x1", "--cell-size", "32x32", "--art-style", "custom", "--style-notes", "cozy gouache", "--output-dir", run)
            prompt = (run / "prompts/generation-prompt.txt").read_text()
            self.assertIn("cozy gouache", prompt)
            self.assertNotIn("Avoid painterly", prompt)
            self.call("prepare_sprite_run.py", "--concept", "test", "--output-dir", run, "--force", ok=False)
            self.assertTrue((run / "sprite_request.json").exists())
            source = root / "fixture.png"
            img = Image.new("RGBA", (64, 32))
            draw = ImageDraw.Draw(img)
            draw.rectangle((10, 10, 18, 18), fill="red")
            draw.rectangle((42, 11, 50, 19), fill="blue")
            img.save(source)
            self.call("record_sprite_result.py", "--run-dir", run, "--source", source)
            self.call("slice_asset_sheet.py", "--run-dir", run, "--no-chroma")
            self.call("validate_sprite_assets.py", "--run-dir", run)
            self.call("make_asset_contact_sheet.py", "--run-dir", run, "--scale", "1")
            self.call("render_asset_preview.py", "--run-dir", run, "--scale", "1", "--fps", "6", "--ffmpeg", "/nonexistent/optional-ffmpeg")
            with Image.open(run / "preview/preview.gif") as gif:
                self.assertEqual(gif.n_frames, 2)
            self.call("package_sprite_assets.py", "--run-dir", run)
            p = subprocess.run(["node", str(REPO / "tools/spritegen-export.mjs"), "--package", str(run / "package"), "--out", str(root / "export"), "--id", "game112/test", "--url", "/games/game112/art/test.png", "--license", "Synthetic test only", "--visual-approved"], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertTrue((root / "export/image-node.json").exists())
            # Do not silently stretch a mismatched source.
            Image.new("RGBA", (63, 32)).save(run / "source/source.png")
            self.call("slice_asset_sheet.py", "--run-dir", run, ok=False)
            # Empty frames must fail, not just warn.
            Image.new("RGBA", (32, 32)).save(run / "slices/cell-r00-c00.png")
            self.call("validate_sprite_assets.py", "--run-dir", run, ok=False)
            self.assertTrue(json.loads((run / "qa/review.json").read_text())["errors"])

if __name__ == "__main__":
    unittest.main()
