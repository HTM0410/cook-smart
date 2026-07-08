# Rollback Procedure (Lambda)

## Khi nào cần rollback

- Smoke test fail ngay sau deploy (xem workflow `deploy-prod.yml` step "Smoke test").
- CloudWatch alarm `*-backend-errors-high` hoặc `*-yolo-errors-high` kich hoat.
- API Gateway 5xx > 10 trong 5 phut.
- YOLO init duration > 5s lien tuc (Provisioned Concurrency exhausted).
- Drift job fail 2 lan lien tiep.
- Bat ky loi nao anh huong user-facing detection.

## Cac cap rollback

### Cap 1: Lambda alias revert (khuyen nghi - 30 giay)

Lambda alias `prod` luon tro ve 1 version cu the. Moi deployment publish version moi
va update alias. Rollback chi can tro alias ve version truoc do.

Bang AWS CLI:

```bash
# Lay version hien tai cua alias
CURRENT=$(aws lambda get-alias \
    --function-name cooksmart-prod-v2-yolo-infer \
    --name prod \
    --region ap-southeast-1 \
    --query 'FunctionVersion' --output text)
echo "Current version: $CURRENT"

# Lay version truoc do
PREVIOUS=$(aws lambda list-versions-by-function \
    --function-name cooksmart-prod-v2-yolo-infer \
    --region ap-southeast-1 \
    --query 'Versions[?Version!=`$LATEST`].Version' --output text \
    | tr '\t' '\n' | sort -rn \
    | awk -v c="$CURRENT" '$0 > c' | tail -1)

# Revert alias
aws lambda update-alias \
    --function-name cooksmart-prod-v2-yolo-infer \
    --name prod \
    --function-version "$PREVIOUS" \
    --region ap-southeast-1
```

Bang script helper (PowerShell - Windows dev):

```powershell
.\infra\scripts\deploy-lambda.ps1 `
    -Function cooksmart-prod-v2-yolo-infer `
    -Rollback
```

Bang script helper (Bash - CI/Linux):

```bash
bash infra/scripts/deploy-lambda.sh \
    --function cooksmart-prod-v2-yolo-infer \
    --rollback
```

**Thoi gian revert:** < 30 giay (alias update la atomic, moi request moi se dung version moi).

### Cap 2: Rollback model artifact (W&B alias + S3 pointer)

Ap dung khi: container code work, nhung model moi bi loi logic detection.

#### 2a. W&B alias revert (training pipeline)

```python
import wandb
api = wandb.Api()
art = api.artifact("htm0410/ingredient-detection/ingredient-detector:v_old_hash")
art.aliases.append("production")
art.save()
```

#### 2b. S3 + DynamoDB revert (runtime serving - primary)

Dung CLI moi:

```bash
python -m mlops.serving.promote_and_mirror promote-and-mirror \
    --entity htm0410 \
    --project ingredient-detection \
    --artifact ingredient-detector \
    --from-alias candidate \
    --to-alias production \
    --bucket cooksmart-models \
    --semver v2026.07.08-rollback
```

Hoac update DynamoDB truc tiep de alias 'production' tro ve version cu:

```bash
aws dynamodb put-item \
    --table-name cooksmart-model-versions \
    --item '{
        "PK": {"S": "ALIAS#production"},
        "SK": {"S": "POINTER"},
        "alias": "production",
        "version": "v2026.07.05-previous",
        "updated_at": {"S": "'"$(date -u +%FT%TZ)"'"}
    }' \
    --region ap-southeast-1
```

Sau do restart Lambda function de no reload model tu S3 (Lambda khong
auto-poll S3 path; can redeploy hoac restart):

```bash
# Force Lambda restart: publish version moi voi cung code
aws lambda publish-version \
    --function-name cooksmart-prod-v2-yolo-infer \
    --region ap-southeast-1

# Update alias tro ve version moi (se trigger init lai)
aws lambda update-alias \
    --function-name cooksmart-prod-v2-yolo-infer \
    --name prod \
    --function-version <new-version> \
    --region ap-southeast-1
```

### Cap 3: Re-deploy service cu (khi Cap 1+2 khong work)

Neu code moi gay crash Lambda, alias revert van se crash (vi alias chi doi
function version, code van vay). Can deploy image cu len Lambda:

```bash
# Lay image cu tu ECR
OLD_IMAGE="294060270105.dkr.ecr.ap-southeast-1.amazonaws.com/cooksmart-yolo:v2026.07.05"

# Update function code (khong publish)
aws lambda update-function-code \
    --function-name cooksmart-prod-v2-yolo-infer \
    --image-uri "$OLD_IMAGE" \
    --region ap-southeast-1

# Publish version moi
NEW_VER=$(aws lambda publish-version \
    --function-name cooksmart-prod-v2-yolo-infer \
    --region ap-southeast-1 \
    --query 'Version' --output text)

# Update alias
aws lambda update-alias \
    --function-name cooksmart-prod-v2-yolo-infer \
    --name prod \
    --function-version "$NEW_VER" \
    --region ap-southeast-1
```

### Cap 4: Switch sang ECS stack cu (disaster recovery)

Stack Lambda va ECS chay song song (Terraform state rieng:
`prod-v2-lambda` vs `prod-v2`). Neu Lambda co van de lon, revert DNS/traffic
ve ECS:

```bash
# 1. Lay ALB DNS cua ECS stack
ECS_ALB=$(terraform -chdir=infra/envs/prod-ecs output -raw alb_dns_name)

# 2. Update Route 53 record set tro ve ECS ALB
aws route53 change-resource-record-sets \
    --hosted-zone-id Z123... \
    --change-batch '{
        "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "api.cooksmart.example.com",
                "Type": "CNAME",
                "TTL": 60,
                "ResourceRecords": [{"Value": "'"$ECS_ALB"'"}]
            }
        }]
    }'

# 3. Verify ECS service van healthy
aws ecs describe-services \
    --cluster cooksmart-prod-v2 \
    --services cooksmart-prod-v2-yolo-svc \
    --query 'services[0].deployments[0].status'
```

### Cap 5: Disaster toan bo (downtime > 5 phut)

1. Goi team SRE ngay lap tuc.
2. Mo war room: conference bridge, pin status updates vao Slack `#incidents`.
3. Neu Lambda stack failed: switch DNS ve ECS stack (xem Cap 4).
4. Neu ca hai stack failed: dung Route 53 health check reroute traffic ve
   static S3 + CloudFront page "We're back soon".

## Post-rollback checklist

- [ ] Xac nhan API Gateway responses 200 (smoke test workflow `deploy-prod.yml`).
- [ ] Verify CloudWatch metrics (errors, duration, throttles) on dinh.
- [ ] Verify `/yolo/health` va `/health` tra ve `200` qua curl.
- [ ] Verify drift job chay thanh cong o chu ky tiep theo.
- [ ] Tao incident report: timeline, root cause, impact, mitigation.
- [ ] Update `BAO_CAO_MLOPS.md` voi section "Su co & phan hoi" ghi nhan vu nay.
- [ ] Mo ticket de fix root cause -> schedule retrain pipeline.

## Vai tro khi rollback

| Nguoi | Hanh dong |
|-------|-----------|
| SRE primary | Thuc hien rollback, kiem tra CloudWatch metrics |
| ML Engineer | Verify W&B alias + S3 pointer revert, prepare fix |
| Product Owner | Approve communication toi users (neu can) |
| Incident Commander | Coordinate, lead war room |
