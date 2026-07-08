from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

import numpy as np

# Drift modules import kha don gian, dat tests o day.
from mlops.drift.concept_drift import concept_drift
from mlops.drift.data_drift import data_drift_score
from mlops.drift.prediction_drift import prediction_drift


class DataDriftTest(unittest.TestCase):
    """Kiem tra data_drift voi synthetic embedding co drift gia lap."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["BASELINE_EMBEDDINGS_PATH"] = str(
            Path(self.tmp.name) / "baseline_embeddings.npy"
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()
        for key in (
            "BASELINE_EMBEDDINGS_PATH",
            "BASELINE_COUNTS_PATH",
            "BASELINE_CONFIDENCE_PATH",
        ):
            os.environ.pop(key, None)

    def test_no_drift_when_distributions_match(self) -> None:
        rng = np.random.default_rng(seed=42)
        baseline = rng.normal(loc=0.0, scale=1.0, size=(200, 8)).astype(np.float32)
        live = rng.normal(loc=0.0, scale=1.0, size=(200, 8)).astype(np.float32)
        np.save(os.environ["BASELINE_EMBEDDINGS_PATH"], baseline)
        result = data_drift_score(live)
        self.assertFalse(result["drift"], f"Khong nen drift nhung bao: {result}")

    def test_drift_detected_when_live_is_shifted(self) -> None:
        rng = np.random.default_rng(seed=43)
        # Multivariate normal baseline, correlated
        mean = np.zeros(8)
        cov = np.eye(8)
        baseline = rng.multivariate_normal(mean, cov, size=200).astype(np.float32)
        # Live clearly shifted in mean along first principal axis
        mean_shifted = np.zeros(8)
        mean_shifted[0] = 5.0
        live = rng.multivariate_normal(mean_shifted, cov, size=200).astype(np.float32)
        np.save(os.environ["BASELINE_EMBEDDINGS_PATH"], baseline)
        result = data_drift_score(live)
        self.assertTrue(result["drift"], f"Drift dang ke, phai duoc phat hien, got: {result}")

    def test_empty_live_returns_no_drift(self) -> None:
        baseline = np.zeros((4, 4), dtype=np.float32)
        np.save(os.environ["BASELINE_EMBEDDINGS_PATH"], baseline)
        result = data_drift_score(None)
        self.assertFalse(result["drift"])
        self.assertEqual(result["samples_compared"], 0)


class PredictionDriftTest(unittest.TestCase):
    """Kiem tra prediction_drift voi synthetic class counts."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["BASELINE_COUNTS_PATH"] = str(
            Path(self.tmp.name) / "baseline_class_counts.json"
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()
        os.environ.pop("BASELINE_COUNTS_PATH", None)

    def test_no_drift_when_counts_match(self) -> None:
        Path(os.environ["BASELINE_COUNTS_PATH"]).write_text(
            '{"cam": 100, "chuoi": 100}', encoding="utf-8"
        )
        result = prediction_drift({"cam": 100, "chuoi": 100})
        self.assertFalse(result["drift"])

    def test_drift_detected_when_distribution_shifts(self) -> None:
        Path(os.environ["BASELINE_COUNTS_PATH"]).write_text(
            '{"cam": 100, "chuoi": 100}', encoding="utf-8"
        )
        # Live heavily skewed
        result = prediction_drift({"cam": 1000, "chuoi": 10})
        self.assertTrue(result["drift"])
        self.assertGreater(result["jsd"], 0.0)

    def test_drift_when_live_has_zero_count(self) -> None:
        Path(os.environ["BASELINE_COUNTS_PATH"]).write_text(
            '{"cam": 100}', encoding="utf-8"
        )
        result = prediction_drift({})
        self.assertTrue(result["drift"])
        self.assertEqual(result["baseline_size"], 100)


class ConceptDriftTest(unittest.TestCase):
    """Kiem tra concept_drift voi synthetic confidence."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["BASELINE_CONFIDENCE_PATH"] = str(
            Path(self.tmp.name) / "baseline_confidence.npy"
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()
        os.environ.pop("BASELINE_CONFIDENCE_PATH", None)

    def test_no_drift_when_distribution_matches(self) -> None:
        rng = np.random.default_rng(seed=7)
        baseline = rng.uniform(0.5, 0.95, size=200).astype(np.float32)
        live = rng.uniform(0.5, 0.95, size=200).astype(np.float32)
        np.save(os.environ["BASELINE_CONFIDENCE_PATH"], baseline)
        result = concept_drift(live)
        self.assertFalse(result["drift"])

    def test_drift_when_distribution_shifts(self) -> None:
        rng = np.random.default_rng(seed=8)
        # High-confidence normal distribution
        baseline = rng.normal(loc=0.85, scale=0.05, size=400).astype(np.float32)
        # Low-confidence distribution, mean significantly lower
        live = rng.normal(loc=0.30, scale=0.10, size=400).astype(np.float32)
        np.save(os.environ["BASELINE_CONFIDENCE_PATH"], baseline)
        result = concept_drift(live)
        self.assertTrue(result["drift"], f"Drift should be detected, got: {result}")

    def test_no_drift_when_live_empty(self) -> None:
        baseline = np.zeros(50, dtype=np.float32)
        np.save(os.environ["BASELINE_CONFIDENCE_PATH"], baseline)
        result = concept_drift(None)
        self.assertFalse(result["drift"])


if __name__ == "__main__":
    unittest.main()
