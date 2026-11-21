import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("preview_preflight", ROOT / "scripts/check-preview.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class PreviewPreflightTests(unittest.TestCase):
    def setUp(self):
        work = ROOT / ".cache/preview-preflight"
        work.mkdir(parents=True, exist_ok=True)
        workspace = tempfile.TemporaryDirectory(dir=work)
        self.addCleanup(workspace.cleanup)
        self.output = Path(workspace.name)
        self.shard = "data/questions/basic/115.json"
        self.write("index.html", '<script type="module" src="/assets/app.js"></script>')
        self.write("assets/app.js", "import.meta.url")
        self.write("data/question-index.json", [{"filePath": "/" + self.shard, "questionCount": 1}])
        self.write("data/question-key-map.json", {"q": "/" + self.shard})

    def write(self, path, content):
        target = self.output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content if isinstance(content, str) else json.dumps(content))

    def test_browser_image_paths_and_unique_count(self):
        self.write(self.shard, [{
            "question": r"{{image:C:\old\題號.png}} {{image:/uploads/題號.png}}",
            "options": {"A": "{{image:/uploads/sub/answer%20A.png}}"},
            "image": {"src": "/uploads/direct.png"},
            "explanation": {"summary": "{{image:圖.png}}"},
        }])
        for name in ["題號.png", "sub/answer A.png", "direct.png", "圖.png"]:
            self.write("uploads/" + name, "fixture")
        result = preflight.inspect_preview(self.output)
        self.assertTrue(result["passed"], result["issues"])
        self.assertEqual(result["referencedImagesFromReadableShards"], 4)
        self.assertEqual(result["files"], 9)

    def test_requires_missing_structured_only_images_and_deduplicates_them(self):
        self.write(self.shard, [{"images": [
            {"path": "assets/只在欄位.png"}, {"path": "/uploads/只在欄位.png"},
        ]}])
        result = preflight.inspect_preview(self.output)
        self.assertFalse(result["passed"])
        self.assertEqual(result["issues"]["referenced-image-missing"], 1)
        self.assertEqual(result["examples"]["referenced-image-missing"], ["uploads/只在欄位.png"])
        self.write("uploads/只在欄位.png", "fixture")
        self.assertTrue(preflight.inspect_preview(self.output)["passed"])

    def test_checks_inline_references_outside_the_previous_field_allowlist(self):
        self.write(self.shard, [{"supplement": [{"text": "{{image:extra.png}}"}]}])
        result = preflight.inspect_preview(self.output)
        self.assertFalse(result["passed"])
        self.assertEqual(result["examples"]["referenced-image-missing"], ["uploads/extra.png"])

    def test_rejects_missing_and_nonlocal_images_empty_file_and_oversize(self):
        self.write(self.shard, [{
            "question": "{{image:missing.png}} {{image:https://example.invalid/a.png}}",
            "image": "/uploads/empty.png",
        }])
        self.write("uploads/empty.png", "")
        with (self.output / "oversized").open("wb") as target:
            target.truncate(preflight.MAX_SIZE + 1)
        result = preflight.inspect_preview(self.output)
        self.assertFalse(result["passed"])
        self.assertFalse(result["withinPagesFreeAssetLimits"])
        self.assertEqual(result["largestAsset"]["bytes"], preflight.MAX_SIZE + 1)
        self.assertEqual(result["issues"]["referenced-image-missing"], 1)
        self.assertEqual(result["issues"]["referenced-image-empty"], 1)
        self.assertEqual(result["issues"]["image-nonlocal"], 1)

    def test_dataless_shard_is_not_opened(self):
        self.write(self.shard, [{"question": "placeholder"}])
        placeholder = self.output / self.shard
        original_stat, original_read = Path.lstat, Path.read_bytes

        def metadata(path):
            info = original_stat(path)
            if path != placeholder:
                return info
            return type("PlaceholderStat", (), {
                "st_mode": info.st_mode, "st_size": info.st_size, "st_flags": preflight.DATALESS,
            })()

        def read(path):
            self.assertNotEqual(path, placeholder, "read would hydrate the file")
            return original_read(path)

        with patch.object(Path, "lstat", metadata), patch.object(Path, "read_bytes", read):
            result = preflight.inspect_preview(self.output)
        self.assertEqual(result["issues"]["catalog-dataless"], 1)
        self.assertEqual(result["unavailableShards"], [self.shard])

    def test_missing_shard_prevents_pass_even_when_known_images_are_clear(self):
        result = preflight.inspect_preview(self.output)
        self.assertFalse(result["passed"])
        self.assertEqual(result["unavailableShards"], [self.shard])
        self.assertEqual(result["inspectedQuestions"], 0)
        self.assertEqual(result["issues"]["catalog-missing"], 1)


if __name__ == "__main__":
    unittest.main()
