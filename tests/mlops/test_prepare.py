from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import yaml

from mlops.ingredient_detection.prepare import prepare


class PrepareDatasetTest(unittest.TestCase):
    def test_prepares_valid_yolo_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for split in ("train", "val"):
                (root / "images" / split).mkdir(parents=True)
                (root / "labels" / split).mkdir(parents=True)
                (root / "images" / split / "sample.jpg").write_bytes(b"not-decoded-by-validator")
                (root / "labels" / split / "sample.txt").write_text(
                    "0 0.5 0.5 0.25 0.25\n", encoding="utf-8"
                )

            source = root / "data.yaml"
            source.write_text("nc: 1\nnames: [tom]\n", encoding="utf-8")
            output = root / "prepared" / "data.yaml"
            report = root / "reports" / "dataset.json"
            prepare(root, source, output, report)

            config = yaml.safe_load(output.read_text(encoding="utf-8"))
            self.assertEqual(config["nc"], 1)
            self.assertTrue(report.is_file())

    def test_rejects_missing_labels(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for split in ("train", "val"):
                (root / "images" / split).mkdir(parents=True)
                (root / "labels" / split).mkdir(parents=True)
                (root / "images" / split / "sample.jpg").write_bytes(b"x")
            source = root / "data.yaml"
            source.write_text("nc: 1\nnames: [tom]\n", encoding="utf-8")

            with self.assertRaises(ValueError):
                prepare(root, source, root / "out.yaml", root / "report.json")

    def test_prepares_roboflow_split_layout(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for split in ("train", "valid"):
                (root / split / "images").mkdir(parents=True)
                (root / split / "labels").mkdir(parents=True)
                (root / split / "images" / "sample.jpg").write_bytes(b"image-placeholder")
                (root / split / "labels" / "sample.txt").write_text(
                    "0 0.5 0.5 0.25 0.25\n", encoding="utf-8"
                )

            source = root / "data.yaml"
            source.write_text(
                "train: train/images\nval: valid/images\nnc: 1\nnames: [tom]\n",
                encoding="utf-8",
            )
            output = root / "prepared" / "data.yaml"
            prepare(root, source, output, root / "reports" / "dataset.json")

            config = yaml.safe_load(output.read_text(encoding="utf-8"))
            self.assertEqual(config["train"], "train/images")
            self.assertEqual(config["val"], "valid/images")


if __name__ == "__main__":
    unittest.main()
