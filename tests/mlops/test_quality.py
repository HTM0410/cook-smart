from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mlops.ingredient_detection.prepare import prepare
from mlops.ingredient_detection.quality import quality_gate


def write_sample(root: Path, split: str, name: str, class_id: int, content: bytes | None = None) -> None:
    (root / split / "images").mkdir(parents=True, exist_ok=True)
    (root / split / "labels").mkdir(parents=True, exist_ok=True)
    (root / split / "images" / f"{name}.jpg").write_bytes(content or f"{split}-{name}".encode("utf-8"))
    (root / split / "labels" / f"{name}.txt").write_text(
        f"{class_id} 0.5 0.5 0.25 0.25\n",
        encoding="utf-8",
    )


class QualityGateTest(unittest.TestCase):
    def test_quality_gate_passes_for_balanced_dataset(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for split in ("train", "valid", "test"):
                write_sample(root, split, "tom", 0)
                write_sample(root, split, "carrot", 1)
            source = root / "data.yaml"
            source.write_text(
                "train: train/images\nval: valid/images\ntest: test/images\nnc: 2\nnames: [tom, carrot]\n",
                encoding="utf-8",
            )
            params = root / "params.yaml"
            params.write_text(
                "\n".join(
                    [
                        "data_quality:",
                        "  min_images_per_split:",
                        "    train: 2",
                        "    val: 2",
                        "    test: 2",
                        "  require_all_classes_in_train: true",
                        "  max_duplicate_image_ratio: 0.5",
                        "  max_train_imbalance_ratio: 10.0",
                    ]
                ),
                encoding="utf-8",
            )
            prepared = root / "prepared" / "data.yaml"
            dataset_report = root / "reports" / "dataset.json"
            quality_report = root / "reports" / "data_quality.json"
            prepare(root, source, prepared, dataset_report, require_test=True)

            quality_gate(params, prepared, dataset_report, quality_report)

            self.assertIn('"quality_gate_passed": true', quality_report.read_text(encoding="utf-8"))

    def test_quality_gate_rejects_missing_train_class(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_sample(root, "train", "tom", 0)
            for split in ("valid", "test"):
                write_sample(root, split, "tom", 0)
                write_sample(root, split, "carrot", 1)
            source = root / "data.yaml"
            source.write_text(
                "train: train/images\nval: valid/images\ntest: test/images\nnc: 2\nnames: [tom, carrot]\n",
                encoding="utf-8",
            )
            params = root / "params.yaml"
            params.write_text(
                "data_quality:\n  require_all_classes_in_train: true\n  max_duplicate_image_ratio: 1.0\n",
                encoding="utf-8",
            )
            prepared = root / "prepared" / "data.yaml"
            dataset_report = root / "reports" / "dataset.json"
            prepare(root, source, prepared, dataset_report, require_test=True)

            with self.assertRaises(SystemExit):
                quality_gate(params, prepared, dataset_report, root / "reports" / "data_quality.json")


if __name__ == "__main__":
    unittest.main()
