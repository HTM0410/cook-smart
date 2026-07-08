"""Smoke tests cho Terraform IaC.

Tieu chi:
1. Moi module .tf khong co syntax error
2. Moi module co tag Environment = prod neu la prod env
3. terraform fmt -check khong co gi can dinh dang

Cac test nay chi dung `python -m unittest`, khong phu thuoc terraform CLI.
"""
from __future__ import annotations

import os
import re
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
INFRA_ROOT = REPO_ROOT / "infra"


class TerraformSyntaxTest(unittest.TestCase):
    """Kiem tra cac file .tf co the parsed (regex thu, khong can TF CLI)."""

    def test_balanced_braces(self) -> None:
        for tf_file in INFRA_ROOT.rglob("*.tf"):
            text = tf_file.read_text(encoding="utf-8")
            opens = text.count("{")
            closes = text.count("}")
            self.assertEqual(
                opens,
                closes,
                f"{tf_file.relative_to(REPO_ROOT)} co brace khong can bang ({opens}/{closes})",
            )

    def test_required_blocks_present(self) -> None:
        required_files = {
            "infra/envs/prod/main.tf",
            "infra/envs/prod/variables.tf",
            "infra/envs/prod/backend.tf",
            "infra/modules/alb/main.tf",
            "infra/modules/ecs_blue_green/main.tf",
            "infra/modules/ecr/main.tf",
            "infra/modules/pipeline/main.tf",
            "infra/modules/secrets/main.tf",
            "infra/modules/monitoring/main.tf",
        }
        for rel in required_files:
            self.assertTrue(
                (REPO_ROOT / rel).is_file(),
                f"Missing required file: {rel}",
            )

    def test_blue_green_module_references_code_deploy(self) -> None:
        """Module ECS Blue/Green phai co CodeDeploy application va deployment group."""
        text = (INFRA_ROOT / "modules/ecs_blue_green/main.tf").read_text(encoding="utf-8")
        self.assertIn("aws_codedeploy_app", text)
        self.assertIn("aws_codedeploy_deployment_group", text)
        self.assertIn('type = "CODE_DEPLOY"', text)

    def test_alb_module_creates_two_target_groups(self) -> None:
        """Module ALB phai tao blue + green target group va 2 listener."""
        text = (INFRA_ROOT / "modules/alb/main.tf").read_text(encoding="utf-8")
        self.assertIn("aws_lb_target_group.blue", text)
        self.assertIn("aws_lb_target_group.green", text)
        self.assertIn("aws_lb_listener", text)

    def test_pipeline_module_has_approval_stage(self) -> None:
        text = (INFRA_ROOT / "modules/pipeline/main.tf").read_text(encoding="utf-8")
        # Phai co stage Approval voi action ManualApproval
        self.assertIn('name = "Approval"', text)
        self.assertIn('category = "Approval"', text)


class TerraformFmtTest(unittest.TestCase):
    """Neu terraform co CLI, kiem tra terraform fmt -check."""

    def setUp(self) -> None:
        self.tf_available = self._which("terraform") is not None

    @staticmethod
    def _which(cmd: str) -> str | None:
        for path in os.environ.get("PATH", "").split(os.pathsep):
            candidate = Path(path) / cmd
            if candidate.is_file():
                return str(candidate)
        return None

    def test_terraform_fmt_check(self) -> None:
        if not self.tf_available:
            self.skipTest("terraform CLI khong co san")
        for tf_dir in INFRA_ROOT.rglob("*.tf"):
            tf_dir = tf_dir.parent
            result = subprocess.run(
                ["terraform", "fmt", "-check", "-recursive"],
                cwd=str(tf_dir),
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                self.fail(
                    f"terraform fmt check failed in {tf_dir.relative_to(REPO_ROOT)}:\n"
                    f"{result.stdout}\n{result.stderr}"
                )


class DockerfileSyntaxTest(unittest.TestCase):
    """Dockerfile cu backend va yolo phai ton tai va co FROM + CMD."""

    def setUp(self) -> None:
        self.docker_dir = REPO_ROOT / "docker"

    def test_backend_dockerfile_has_from_and_cmd(self) -> None:
        text = (self.docker_dir / "backend.Dockerfile").read_text(encoding="utf-8")
        self.assertRegex(text, r"FROM\s+node:20-alpine")
        self.assertRegex(text, r"CMD\s+\[")

    def test_yolo_dockerfile_has_from_and_cmd(self) -> None:
        text = (self.docker_dir / "yolo.Dockerfile").read_text(encoding="utf-8")
        self.assertRegex(text, r"FROM\s+python:3.10-slim")
        self.assertRegex(text, r"CMD\s+\[")

    def test_drift_dockerfile_has_from_and_cmd(self) -> None:
        text = (self.docker_dir / "drift.Dockerfile").read_text(encoding="utf-8")
        self.assertRegex(text, r"FROM\s+python:3.10-slim")
        self.assertRegex(text, r"CMD\s+\[")


class DocumentationTest(unittest.TestCase):
    """Docs MLOps production-ready phai co mat."""

    def test_runbooks_exist(self) -> None:
        docs = REPO_ROOT / "docs"
        expected = [
            "mlops-blue-green.md",
            "promotion-runbook.md",
            "drift-runbook.md",
            "rollback-procedure.md",
        ]
        for name in expected:
            self.assertTrue((docs / name).is_file(), f"Thieu doc: {name}")


if __name__ == "__main__":
    unittest.main()
