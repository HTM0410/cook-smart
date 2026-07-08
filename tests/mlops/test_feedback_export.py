"""Tests for feedbackExportService utilities.

Kiem tra cac pure-Python helpers (difference, intersection) ma khong can
import backend modules. Day la smoke test dac biet huu ich khi CI chay
truoc khi backend duoc build.
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path


def difference(source, target):
    """Mirror of feedbackExportService.difference (khong can import)."""
    set_t = set(target)
    return [s for s in source if s not in set_t]


def intersection(source, target):
    set_t = set(target)
    return [s for s in source if s in set_t]


class DifferenceIntersectionTest(unittest.TestCase):
    def test_difference(self) -> None:
        self.assertEqual(difference(["a", "b", "c"], ["b"]), ["a", "c"])
        self.assertEqual(difference([], ["a"]), [])
        self.assertEqual(difference(["a", "b"], []), ["a", "b"])
        self.assertEqual(difference(["a", "a", "b"], ["a"]), ["b"])  # giữ thứ tự

    def test_intersection(self) -> None:
        self.assertEqual(intersection(["a", "b"], ["b", "c"]), ["b"])
        self.assertEqual(intersection([], ["a"]), [])
        self.assertEqual(intersection(["a"], []), [])


class YoloLabelFileTest(unittest.TestCase):
    """Kiem tra format label file: 1 dong/class, field la index bbox name."""

    def test_label_file_format(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            labels_dir = Path(tmp) / "labels"
            labels_dir.mkdir(parents=True)
            target = labels_dir / "abc123.txt"
            class_names = ["cam", "chuoi"]
            # Giong format production: 0 0.5 0.5 0.99 0.99 cam
            with target.open("w", encoding="utf-8") as fh:
                for idx, name in enumerate(class_names):
                    fh.write(f"{idx} 0.5 0.5 0.99 0.99 {name}\n")
            text = target.read_text(encoding="utf-8")
            lines = [l for l in text.splitlines() if l]
            self.assertEqual(len(lines), 2)
            self.assertIn("cam", lines[0])
            self.assertIn("chuoi", lines[1])

    def test_manifest_writes_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "inc"
            out.mkdir()
            manifest = {
                "exportedAt": "2026-07-07T00:00:00Z",
                "count": 1,
                "entries": [
                    {"imageHash": "abc", "labels": ["cam"], "source": "correction"}
                ],
            }
            (out / "manifest.json").write_text(
                json.dumps(manifest, indent=2), encoding="utf-8"
            )
            data = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(data["count"], 1)
            self.assertEqual(data["entries"][0]["imageHash"], "abc")


if __name__ == "__main__":
    unittest.main()
