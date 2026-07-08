from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

from .common import read_yaml, write_json


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def parse_names(config: dict[str, Any]) -> list[str]:
    names = config.get("names", [])
    if isinstance(names, dict):
        return [str(names[key]) for key in sorted(names, key=lambda item: int(item))]
    if isinstance(names, list):
        return [str(name) for name in names]
    raise ValueError("data.yaml 'names' must be a list or mapping")


def split_directories(
    dataset_dir: Path,
    image_path: str,
) -> tuple[Path, Path]:
    relative = Path(image_path)
    if relative.is_absolute():
        try:
            relative = relative.relative_to(dataset_dir)
        except ValueError as exc:
            raise ValueError(f"Split path must be inside dataset root: {image_path}") from exc

    parts = relative.parts
    if not parts or "images" not in parts:
        raise ValueError(f"Split path must contain an 'images' directory: {image_path}")

    image_index = parts.index("images")
    label_parts = (*parts[:image_index], "labels", *parts[image_index + 1 :])
    return dataset_dir / relative, dataset_dir.joinpath(*label_parts)


def validate_split(
    dataset_dir: Path,
    split: str,
    image_path: str,
    class_count: int,
) -> dict[str, Any]:
    image_dir, label_dir = split_directories(dataset_dir, image_path)
    if not image_dir.is_dir() or not label_dir.is_dir():
        raise FileNotFoundError(f"Missing images/{split} or labels/{split}")

    images = sorted(path for path in image_dir.rglob("*") if path.suffix.lower() in IMAGE_SUFFIXES)
    if not images:
        raise ValueError(f"No images found in {image_dir}")

    missing_labels: list[str] = []
    invalid_labels: list[str] = []
    class_distribution: Counter[int] = Counter()
    box_count = 0

    for image in images:
        relative = image.relative_to(image_dir).with_suffix(".txt")
        label = label_dir / relative
        if not label.is_file():
            missing_labels.append(str(relative))
            continue
        for line_number, line in enumerate(label.read_text(encoding="utf-8").splitlines(), start=1):
            parts = line.split()
            try:
                class_id = int(parts[0])
                coords = [float(value) for value in parts[1:]]
            except (IndexError, ValueError):
                invalid_labels.append(f"{relative}:{line_number}")
                continue
            if len(coords) != 4 or not 0 <= class_id < class_count or any(
                value < 0 or value > 1 for value in coords
            ):
                invalid_labels.append(f"{relative}:{line_number}")
                continue
            class_distribution[class_id] += 1
            box_count += 1

    if missing_labels or invalid_labels:
        details = {
            "missing_label_count": len(missing_labels),
            "invalid_label_count": len(invalid_labels),
            "missing_label_examples": missing_labels[:10],
            "invalid_label_examples": invalid_labels[:10],
        }
        raise ValueError(f"Dataset validation failed for '{split}': {details}")

    return {
        "images": len(images),
        "labels": len(images),
        "boxes": box_count,
        "class_distribution": {str(key): value for key, value in sorted(class_distribution.items())},
    }


def prepare(
    dataset_dir: Path,
    source_yaml: Path,
    output_yaml: Path,
    report_path: Path,
    require_test: bool = False,
) -> None:
    dataset_dir = dataset_dir.resolve()
    config = read_yaml(source_yaml)
    names = parse_names(config)
    if not names:
        raise ValueError("Dataset must define at least one class")
    if int(config.get("nc", len(names))) != len(names):
        raise ValueError("data.yaml 'nc' does not match the number of class names")

    train_path = str(config.get("train", "images/train"))
    val_path = str(config.get("val", "images/val"))
    test_path = config.get("test")
    if require_test and not test_path:
        raise ValueError("Dataset must define a held-out 'test' split")

    splits = {
        "train": validate_split(dataset_dir, "train", train_path, len(names)),
        "val": validate_split(dataset_dir, "val", val_path, len(names)),
    }
    if test_path:
        splits["test"] = validate_split(dataset_dir, "test", str(test_path), len(names))

    prepared = {
        "path": dataset_dir.as_posix(),
        "train": train_path,
        "val": val_path,
        "nc": len(names),
        "names": names,
    }
    if test_path:
        prepared["test"] = str(test_path)

    output_yaml.parent.mkdir(parents=True, exist_ok=True)
    with output_yaml.open("w", encoding="utf-8") as handle:
        yaml.safe_dump(prepared, handle, allow_unicode=True, sort_keys=False)

    write_json(
        report_path,
        {
            "dataset_root": dataset_dir.as_posix(),
            "class_count": len(names),
            "class_names": names,
            "total_images": sum(split["images"] for split in splits.values()),
            "total_boxes": sum(split["boxes"] for split in splits.values()),
            "splits": splits,
        },
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and prepare a YOLO dataset")
    parser.add_argument("--dataset-dir", required=True, type=Path)
    parser.add_argument("--source-yaml", required=True, type=Path)
    parser.add_argument("--output-yaml", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument(
        "--require-test",
        action="store_true",
        help="Require and validate a held-out test split in data.yaml",
    )
    args = parser.parse_args()
    prepare(args.dataset_dir, args.source_yaml, args.output_yaml, args.report, args.require_test)


if __name__ == "__main__":
    main()
