from __future__ import annotations

import argparse
import os


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a W&B model artifact alias")
    parser.add_argument("--source-alias", default="candidate")
    parser.add_argument("--target-alias", default="production")
    args = parser.parse_args()

    import wandb

    entity = os.environ["WANDB_ENTITY"]
    project = os.getenv("WANDB_PROJECT", "ingredient-detection")
    name = os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector")
    artifact = wandb.Api().artifact(f"{entity}/{project}/{name}:{args.source_alias}")
    aliases = set(artifact.aliases)
    aliases.add(args.target_alias)
    artifact.aliases = sorted(aliases)
    artifact.save()
    print(f"Promoted {artifact.name} to alias '{args.target_alias}'")


if __name__ == "__main__":
    main()
