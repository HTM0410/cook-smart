from __future__ import annotations

import argparse
import hashlib
from collections import Counter
from pathlib import Path
from typing import Any

from .common import read_yaml, write_json


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def read_json(path: Path) -> dict[str, Any]:
    import json

    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def split_image_dir(dataset_root: Path, split_path: str) -> Path:
    path = Path(split_path)
    if path.is_absolute():
        return path
    return dataset_root / path


def duplicate_image_report(dataset_root: Path, prepared_yaml: Path) -> dict[str, Any]:
    config = read_yaml(prepared_yaml)
    dataset_root = Path(config.get("path", dataset_root)).resolve()
    split_paths = [
        value
        for key in ("train", "val", "test")
        if (value := config.get(key)) is not None
    ]

    hashes: Counter[str] = Counter()
    examples: dict[str, list[str]] = {}
    image_count = 0
    for split_path in split_paths:
        image_dir = split_image_dir(dataset_root, str(split_path))
        for image in sorted(path for path in image_dir.rglob("*") if path.suffix.lower() in IMAGE_SUFFIXES):
            image_count += 1
            digest = sha256_file(image)
            hashes[digest] += 1
            examples.setdefault(digest, []).append(str(image.relative_to(dataset_root)))

    duplicate_groups = {digest: paths for digest, paths in examples.items() if len(paths) > 1}
    duplicate_images = sum(len(paths) - 1 for paths in duplicate_groups.values())
    ratio = duplicate_images / image_count if image_count else 0.0
    return {
        "image_count": image_count,
        "duplicate_image_count": duplicate_images,
        "duplicate_image_ratio": ratio,
        "duplicate_examples": list(duplicate_groups.values())[:10],
    }


def class_coverage(dataset_report: dict[str, Any]) -> dict[str, Any]:
    class_count = int(dataset_report["class_count"])
    split_reports = dataset_report.get("splits", {})
    coverage: dict[str, Any] = {}
    for split, report in split_reports.items():
        distribution = {
            int(class_id): int(count)
            for class_id, count in (report.get("class_distribution") or {}).items()
        }
        missing = [class_id for class_id in range(class_count) if distribution.get(class_id, 0) == 0]
        counts = [distribution.get(class_id, 0) for class_id in range(class_count)]
        nonzero = [count for count in counts if count > 0]
        imbalance_ratio = (max(nonzero) / min(nonzero)) if nonzero else 0.0
        coverage[str(split)] = {
            "missing_class_ids": missing,
            "missing_class_count": len(missing),
            "min_boxes_per_present_class": min(nonzero) if nonzero else 0,
            "max_boxes_per_present_class": max(nonzero) if nonzero else 0,
            "imbalance_ratio_present_classes": imbalance_ratio,
        }
    return coverage


def evaluate_quality(params: dict[str, Any], dataset_report: dict[str, Any], duplicate_report: dict[str, Any]) -> dict[str, Any]:
    quality = params.get("data_quality", {})
    coverage = class_coverage(dataset_report)
    checks: list[dict[str, Any]] = []

    min_images = quality.get("min_images_per_split", {})
    for split, minimum in min_images.items():
        actual = int(dataset_report.get("splits", {}).get(split, {}).get("images", 0))
        checks.append(
            {
                "name": f"{split}_min_images",
                "passed": actual >= int(minimum),
                "actual": actual,
                "threshold": int(minimum),
            }
        )

    if bool(quality.get("require_all_classes_in_train", True)):
        missing = coverage.get("train", {}).get("missing_class_ids", [])
        checks.append(
            {
                "name": "train_class_coverage",
                "passed": len(missing) == 0,
                "missing_class_ids": missing,
            }
        )

    max_duplicate_ratio = float(quality.get("max_duplicate_image_ratio", 1.0))
    checks.append(
        {
            "name": "duplicate_image_ratio",
            "passed": float(duplicate_report["duplicate_image_ratio"]) <= max_duplicate_ratio,
            "actual": duplicate_report["duplicate_image_ratio"],
            "threshold": max_duplicate_ratio,
        }
    )

    max_imbalance_ratio = quality.get("max_train_imbalance_ratio")
    if max_imbalance_ratio is not None:
        actual = float(coverage.get("train", {}).get("imbalance_ratio_present_classes", 0.0))
        checks.append(
            {
                "name": "train_class_imbalance",
                "passed": actual <= float(max_imbalance_ratio),
                "actual": actual,
                "threshold": float(max_imbalance_ratio),
            }
        )

    passed = all(check["passed"] for check in checks)
    return {
        "quality_gate_passed": passed,
        "checks": checks,
        "class_coverage": coverage,
        "duplicates": duplicate_report,
    }


def quality_gate(params_path: Path, prepared_yaml: Path, dataset_report_path: Path, output_path: Path) -> None:
    params = read_yaml(params_path)
    dataset_report = read_json(dataset_report_path)
    dataset_root = Path(read_yaml(prepared_yaml)["path"]).resolve()
    duplicate_report = duplicate_image_report(dataset_root, prepared_yaml)
    report = evaluate_quality(params, dataset_report, duplicate_report)
    write_json(output_path, report)
    if not report["quality_gate_passed"]:
        failed = ", ".join(check["name"] for check in report["checks"] if not check["passed"])
        raise SystemExit(f"Data quality gate failed: {failed}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ingredient dataset quality gates")
    parser.add_argument("--params", default="params.yaml", type=Path)
    parser.add_argument("--prepared-yaml", required=True, type=Path)
    parser.add_argument("--dataset-report", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    quality_gate(args.params, args.prepared_yaml, args.dataset_report, args.output)


if __name__ == "__main__":
    main()
