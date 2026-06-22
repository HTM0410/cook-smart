from __future__ import annotations

import argparse
from pathlib import Path

from .common import metric_dict, read_yaml, write_json


def evaluate(params_path: Path, data_yaml: Path, model_path: Path, output_path: Path) -> None:
    from ultralytics import YOLO

    params = read_yaml(params_path)
    evaluation = params["evaluate"]
    result = YOLO(str(model_path)).val(
        data=str(data_yaml.resolve()),
        imgsz=int(params["train"]["imgsz"]),
        batch=int(evaluation["batch"]),
        device=str(params["train"]["device"]),
        split="val",
        plots=True,
        verbose=True,
    )
    metrics = metric_dict(result)
    map50 = metrics.get("metrics/mAP50(B)", 0.0)
    map5095 = metrics.get("metrics/mAP50-95(B)", 0.0)
    passed = map50 >= float(evaluation["min_map50"]) and map5095 >= float(evaluation["min_map50_95"])
    write_json(output_path, {**metrics, "quality_gate_passed": passed})
    if not passed:
        raise SystemExit(
            f"Quality gate failed: mAP50={map50:.4f}, mAP50-95={map5095:.4f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a trained YOLO model")
    parser.add_argument("--params", default="params.yaml", type=Path)
    parser.add_argument("--data-yaml", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    evaluate(args.params, args.data_yaml, args.model, args.output)


if __name__ == "__main__":
    main()
