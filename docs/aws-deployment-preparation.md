# Hướng dẫn tìm thông tin AWS để triển khai MLOps Production

## Bước 1: Lấy Access Key từ IAM User

Nếu chưa có Access Key:

1. Mở AWS Console → Tìm **"IAM"** ở thanh search → Enter
2. Menu trái → **Users** → Click vào username của bạn (hoặc tạo user mới nếu chưa có)
3. Tab **Security credentials** → Cuộn xuống **Access keys** → **Create access key**
4. Chọn use case: **Command Line Interface (CLI)** → Check "I understand..." → Next
5. **Description tag** (optional): `mlops-deploy` → Next
6. **LƯU LẠI CẢ 2:**
   - `Access key` (bắt đầu bằng `AKIA...`)
   - `Secret access key` (chỉ hiển thị 1 lần duy nhất!)

## Bước 2: Configure AWS CLI

Mở PowerShell, chạy:

```powershell
aws configure
```

Nhập:

```
AWS Access Key ID [None]: <paste Access key của bạn>
AWS Secret Access Key [None]: <paste Secret access key>
Default region name [None]: ap-southeast-1
Default output format [None]: json
```

## Bước 3: Verify credentials hoạt động

```powershell
aws sts get-caller-identity
```

Kết quả OK mẫu:

```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

→ Ghi nhớ **Account ID** (12 số, vd `123456789012`).

## Bước 4: Lấy VPC + Subnet IDs

```powershell
# Lấy VPC IDs
aws ec2 describe-vpcs --query "Vpcs[].[VpcId,Tags[?Key=='Name'].Value|[0]]" --output table
```

Kết quả:
```
---------------------------
|     DescribeVpcs        |
+----------+--------------+
|  vpc-xxx | my-vpc-name  |
+----------+--------------+
```

→ Ghi nhớ **VPC ID** (vd `vpc-0abc123def456`).

```powershell
# Lấy Subnets thuộc VPC đó
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC_ID>" --query "Subnets[].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch,Tags[?Key=='Name'].Value|[0]]" --output table
```

Kết quả:
```
-----------------------------------------
|           DescribeSubnets             |
+--------+----------------+-------------+
|  subnet-xxx | ap-southeast-1a | False/True | name |
+--------+----------------+-------------+
```

Cần tối thiểu:
- **2 Public Subnets** ở 2 AZ khác nhau (cho ALB)
- **2 Private Subnets** ở 2 AZ khác nhau (cho ECS tasks, optional nếu dùng NAT)

## Bước 5: Lấy/Upload ACM Certificate (HTTPS cho ALB)

Nếu chưa có certificate:

1. AWS Console → **Certificate Manager** → **Request certificate**
2. Chọn **Request a public certificate** → Next
3. Domain names: Nhập domain của bạn (vd `api.yourdomain.com`)
4. Validation: **DNS validation** (recommended) hoặc Email
5. Sau khi validated, copy **Certificate ARN**:
   ```powershell
   aws acm list-certificates --query "CertificateSummaryList[].[CertificateArn,DomainName]" --output table
   ```

## Bước 6: Tạo CodeStar Connection cho GitHub

CodePipeline cần connect với GitHub repo. Tạo thủ công:

1. AWS Console → **Developer Tools** → **Settings** (hoặc **Connections**)
2. **Create connection** → Chọn **GitHub**
3. Đặt tên: `cooksmart-github`
4. Click **Install a new app** → Authorize GitHub → chọn repo của bạn
5. Quay lại AWS → Refresh → Connection status: **Available**
6. Lấy ARN:
   ```powershell
   aws codestar-connections list-connections --query "Connections[].[ConnectionArn,ConnectionName,ConnectionStatus]" --output table
   ```

## Bước 7: Tạo SNS Topic cho Manual Approval (Optional)

```powershell
aws sns create-topic --name cooksmart-deploy-approval
aws sns subscribe --topic-arn <TopicArn> --protocol email --notification-endpoint your-email@example.com
```

→ Check email để confirm subscription.

## Bước 9: Tạo Netlify Personal Access Token

Frontend sẽ được deploy tự động lên Netlify thông qua GitHub Actions.

1. Truy cập [Netlify User Settings > Applications > Personal access tokens](https://app.netlify.com/user/applications#personal-access-tokens)
2. Click **New access token**
3. Đặt tên: `github-actions-deploy`
4. Copy token và lưu lại
5. Bạn sẽ cần:
   - `NETLIFY_AUTH_TOKEN`: token vừa tạo
   - `NETLIFY_SITE_ID`: ID của site Netlify (nếu chưa có site, tạo mới từ Netlify dashboard)

## Bước 10: Tạo Netlify Site

1. Truy cập [Netlify Dashboard](https://app.netlify.com/)
2. Click **New site from Git**
3. Chọn **GitHub** và authorize
4. Chọn repo `cook-smart`
5. Cấu hình:
   - **Branch**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Base directory**: `src/frontend`
6. Click **Deploy site**
7. Lấy **Site ID** từ Site settings > General > Site information

## Bước 11: Gửi các giá trị cho tôi

Bạn paste các giá trị sau vào chat, tôi sẽ tạo `terraform.tfvars`:

```hcl
aws_region       = "ap-southeast-1"
account_id       = "123456789012"
vpc_id           = "vpc-xxx"
public_subnets   = ["subnet-aaa", "subnet-bbb"]   # ít nhất 2
private_subnets  = ["subnet-ccc", "subnet-ddd"]   # hoặc để trống nếu tất cả public
acm_arn          = "arn:aws:acm:ap-southeast-1:123456789012:certificate/xxx"  # hoặc null
codestar_arn     = "arn:aws:codestar-connections:ap-southeast-1:123456789012:connection/xxx"
approval_sns_arn = "arn:aws:sns:ap-southeast-1:123456789012:cooksmart-deploy-approval"  # hoặc null
```

## Tips

- Nếu Access Key chỉ có quyền hạn chế, có thể bạn cần liên hệ AWS admin để add policy `AdministratorAccess` hoặc scope permissions như trong `docs/aws-credentials-setup.md`.
- Để test thử trước khi áp vào production, có thể dùng account cá nhân Free Tier (12 tháng) nhưng cẩn thận với chi phí ECS/ALB.