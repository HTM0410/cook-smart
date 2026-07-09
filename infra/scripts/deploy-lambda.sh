#!/usr/bin/env bash
# =============================================================================
# CookSmart Lambda Deploy Helper
# Cap nhat function code cho 1 hoac nhieu Lambda functions.
# Publish version moi + update alias 'prod' tro ve version moi (blue/green).
#
# Su dung:
#   ./deploy-lambda.sh --function cooksmart-prod-v2-yolo-infer --image URI [--alias prod]
#   ./deploy-lambda.sh --function all --image-yolo URI --image-backend URI
# =============================================================================

set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
ALIAS="prod"
PUBLISH=true
WAIT_STABLE=true
FUNCTION=""
IMAGE_URI=""

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
    --function NAME       Ten Lambda function (hoac 'all' de update ca 3 function)
    --image URI           URI ECR image moi
    --alias NAME          Alias can update (default: prod)
    --region NAME         AWS region (default: ap-southeast-1)
    --no-publish          Khong publish version moi (chi update code)
    --no-wait             Khong doi function stable
    --image-yolo URI      (khi --function all) URI cho yolo image
    --image-backend URI   (khi --function all) URI cho backend image
    --image-drift URI     (khi --function all) URI cho drift image
    -h, --help            Hien thi help

Examples:
    $0 --function cooksmart-prod-v2-yolo-infer \\
       --image 294060270105.dkr.ecr.ap-southeast-1.amazonaws.com/cooksmart-yolo:abc1234

    $0 --function all \\
       --image-yolo \$ECR_REG/cooksmart-yolo:\$SHA \\
       --image-backend \$ECR_REG/cooksmart-backend:\$SHA \\
       --image-drift \$ECR_REG/cooksmart-drift:\$SHA
EOF
}

    update_function() {
    local func_name="$1"
    local image="$2"
    local wait="$3"

    echo ">> Updating $func_name -> $image"
    if [ "$PUBLISH" = true ]; then
        NEW_VER=$(aws lambda update-function-code \
            --function-name "$func_name" \
            --image-uri "$image" \
            --region "$REGION" \
            --publish \
            --query 'Version' --output text)
        echo "   Published version: $NEW_VER"

        # Try to create alias, if exists then update
        if aws lambda create-alias \
            --function-name "$func_name" \
            --name "$ALIAS" \
            --function-version "$NEW_VER" \
            --region "$REGION" \
            2>/dev/null; then
            echo "   Alias $ALIAS created -> version $NEW_VER"
        else
            aws lambda update-alias \
                --function-name "$func_name" \
                --name "$ALIAS" \
                --function-version "$NEW_VER" \
                --region "$REGION" \
                2>/dev/null && echo "   Alias $ALIAS updated -> version $NEW_VER"
        fi
    else
        aws lambda update-function-code \
            --function-name "$func_name" \
            --image-uri "$image" \
            --region "$REGION" \
            --query 'LastModified' --output text | xargs -I {} echo "   Updated (no publish) at {}"
    fi

    if [ "$wait" = true ]; then
        echo "   Waiting for $func_name to become Active..."
        aws lambda wait function-updated --function-name "$func_name" --region "$REGION"
        echo "   OK"
    fi
}

rollback_function() {
    local func_name="$1"

    echo ">> Rolling back $func_name via alias $ALIAS"
    # Get current version from alias
    CURRENT=$(aws lambda get-alias --function-name "$func_name" --name "$ALIAS" --region "$REGION" \
        --query 'FunctionVersion' --output text 2>/dev/null || echo "")
    echo "   Current version: $CURRENT"

    # List versions, get previous one
    PREVIOUS=$(aws lambda list-versions-by-function --function-name "$func_name" --region "$REGION" \
        --query 'Versions[?Version!=`$LATEST`].Version' --output text | tr '\t' '\n' \
        | sort -rn | grep -A1 "^${CURRENT}$" | tail -1 || echo "")

    if [ -z "$PREVIOUS" ]; then
        echo "   No previous version found for $func_name"
        exit 1
    fi

    # Try to create alias if not exists, update if exists
    if ! aws lambda update-alias \
        --function-name "$func_name" \
        --name "$ALIAS" \
        --function-version "$PREVIOUS" \
        --region "$REGION" \
        2>/dev/null; then
        aws lambda create-alias \
            --function-name "$func_name" \
            --name "$ALIAS" \
            --function-version "$PREVIOUS" \
            --region "$REGION"
    fi
    echo "   Rolled back to version $PREVIOUS"
}

ALL=false
IMAGE_YOLO=""
IMAGE_BACKEND=""
IMAGE_DRIFT=""
ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --function)  FUNCTION="$2"; shift 2 ;;
        --image)     IMAGE_URI="$2"; shift 2 ;;
        --alias)     ALIAS="$2"; shift 2 ;;
        --region)    REGION="$2"; shift 2 ;;
        --no-publish) PUBLISH=false; shift ;;
        --no-wait)   WAIT_STABLE=false; shift ;;
        --image-yolo)   IMAGE_YOLO="$2"; shift 2 ;;
        --image-backend) IMAGE_BACKEND="$2"; shift 2 ;;
        --image-drift)  IMAGE_DRIFT="$2"; shift 2 ;;
        --rollback) ROLLBACK=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1"; usage; exit 1 ;;
    esac
done

if [ "$FUNCTION" = "all" ]; then
    ALL=true
fi

if [ "$ALL" = true ]; then
    [ -z "$IMAGE_YOLO" ] && { echo "ERROR: --image-yolo required when --function all"; exit 1; }
    [ -z "$IMAGE_BACKEND" ] && { echo "ERROR: --image-backend required when --function all"; exit 1; }
    [ -z "$IMAGE_DRIFT" ] && { echo "ERROR: --image-drift required when --function all"; exit 1; }

    update_function "cooksmart-prod-v2-yolo-infer" "$IMAGE_YOLO" "$WAIT_STABLE"
    update_function "cooksmart-prod-v2-backend-api" "$IMAGE_BACKEND" "$WAIT_STABLE"
    update_function "cooksmart-prod-v2-drift-job" "$IMAGE_DRIFT" "$WAIT_STABLE"
else
    [ -z "$FUNCTION" ] && { echo "ERROR: --function required"; usage; exit 1; }
    [ -z "$IMAGE_URI" ] && { echo "ERROR: --image required"; usage; exit 1; }

    if [ "$ROLLBACK" = true ]; then
        rollback_function "$FUNCTION"
    else
        update_function "$FUNCTION" "$IMAGE_URI" "$WAIT_STABLE"
    fi
fi

echo ">> Done."
