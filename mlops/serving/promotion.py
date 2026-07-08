"""W&B promotion -> trigger CodePipeline.

Sau khi admin goi promote.py de chuyen alias W&B tu 'candidate' sang 'production',
script nay kich hoat CodePipeline build & deploy green task set moi.

Su dung:
    python -m mlops.serving.promotion trigger-pipeline \\
        --pipeline-name cooksmart-prod-pipeline \\
        --region us-east-1

    python -m mlops.serving.promotion promote-and-deploy \\
        --entity htm0410 \\
        --project ingredient-detection \\
        --artifact ingredient-detector \\
        --pipeline-name cooksmart-prod-pipeline \\
        --region us-east-1
"""
from __future__ import annotations

import logging
import os
import sys

import click

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def _trigger_code_pipeline(pipeline_name: str, region: str) -> str:
    """Start CodePipeline execution. Returns execution_id.

    Tra ve 'EXECUTION_ID' de caller log va track tren console.
    Raise RuntimeError neu khong goi duoc AWS.
    """
    try:
        import boto3  # type: ignore
    except ImportError as e:
        raise RuntimeError("boto3 chua duoc cai dat. Cai bang: pip install boto3") from e

    client = boto3.client("codepipeline", region_name=region)
    response = client.start_pipeline_execution(name=pipeline_name)
    execution_id = response.get("pipelineExecutionId")
    if not execution_id:
        raise RuntimeError("CodePipeline khong tra execution_id")
    logger.info("Pipeline %s started execution %s", pipeline_name, execution_id)
    return execution_id


def _promote_wandb(
    entity: str,
    project: str,
    artifact: str,
    from_alias: str = "candidate",
    to_alias: str = "production",
) -> bool:
    """Chuyen alias W&B artifact tu from -> to."""
    try:
        import wandb  # type: ignore
        from wandb.apis.public import Artifact  # noqa: F401  (import de type-check)
    except ImportError as e:
        raise RuntimeError("wandb chua duoc cai dat. Cai bang: pip install wandb") from e

    api = wandb.Api()
    artifact_path = f"{entity}/{project}/{artifact}"
    try:
        art = api.artifact(artifact_path + ":" + from_alias)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Khong the lay artifact {artifact_path}:{from_alias}: {e}") from e

    art.aliases.append(to_alias)
    art.save()
    logger.info("Artifact %s :%s -> :%s done", artifact_path, from_alias, to_alias)
    return True


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------

@click.group()
@click.option("--verbose/--quiet", default=False)
def cli(verbose: bool):
    """MLOps promotion + pipeline trigger utilities."""
    if verbose:
        logger.setLevel(logging.DEBUG)


@cli.command("trigger-pipeline")
@click.option("--pipeline-name", required=True, help="Ten CodePipeline")
@click.option("--region", default=lambda: os.environ.get("AWS_REGION", "us-east-1"))
def trigger_pipeline_cmd(pipeline_name: str, region: str):
    """Khoi dong CodePipeline (build + deploy)."""
    exec_id = _trigger_code_pipeline(pipeline_name, region)
    click.echo(json_safe({"execution_id": exec_id, "pipeline": pipeline_name, "region": region}))


@cli.command("promote-and-deploy")
@click.option("--entity", required=True, help="W&B entity (owner)")
@click.option("--project", required=True, help="W&B project")
@click.option("--artifact", required=True, help="Ten artifact (vd: ingredient-detector)")
@click.option("--from-alias", default="candidate")
@click.option("--to-alias", default="production")
@click.option("--pipeline-name", required=True)
@click.option("--region", default=lambda: os.environ.get("AWS_REGION", "us-east-1"))
def promote_and_deploy_cmd(
    entity: str,
    project: str,
    artifact: str,
    from_alias: str,
    to_alias: str,
    pipeline_name: str,
    region: str,
):
    """Full promote flow: W&B alias update -> trigger CodePipeline."""
    _promote_wandb(entity, project, artifact, from_alias, to_alias)
    exec_id = _trigger_code_pipeline(pipeline_name, region)
    click.echo(
        json_safe(
            {
                "ok": True,
                "wandb_promoted": f"{entity}/{project}/{artifact}:{from_alias}->{to_alias}",
                "pipeline_execution_id": exec_id,
            }
        )
    )


def json_safe(payload) -> str:
    import json

    return json.dumps(payload, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    cli()
else:
    sys.modules[__name__].cli = cli  # de import tu ben ngoai
