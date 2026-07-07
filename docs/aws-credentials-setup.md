# Setup AWS Credentials cho MLOps Production Deployment

## Bước 1: Lấy Access Key từ AWS Console

1. Đăng nhập vào AWS Console với user có quyền admin (root hoặc admin user).
2. Click vào tên user **góc trên bên phải** → **Security credentials** → **Create access key**.
3. Chọn **Command Line Interface (CLI)** → Next → Tạo key.
4. **QUAN TRỌNG**: Lưu lại 2 giá trị:
   - `AWS_ACCESS_KEY_ID` (ví dụ: `AKIAIOSFODNN7EXAMPLE`)
   - `AWS_SECRET_ACCESS_KEY` (ví dụ: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

## Bước 2: Cài đặt & AWS CLI

```powershell
# Đã cài sẵn qua winget
aws --version
# Output mong đợi: aws-cli/2.x.x
```

## Bước 3: Configure AWS CLI

Chạy lệnh sau và nhập thông tin:

```powershell
aws configure
```

Sẽ hỏi 4 thông tin:
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE   # ← Dán Access Key ID
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG...   # ← Dán Secret
Default region name [None]: ap-southeast-1   # ← Region của bạn
Default output format [None]: json
```

**Region khuyến nghị**: `ap-southeast-1` (Singapore, gần Việt Nam nhất).

## Bước 4: Kiểm tra

```powershell
aws sts get-caller-identity
```

Output mẫu:

```json
{
    "UserId": "AIDAEXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

Lưu lại `Account` ID - cần cho Terraform variables.

## Bước 5: IAM Permissions cần thiết

User IAM cần có policy attach: `AdministratorAccess` (nhanh nhất cho dev) HOẶC tạo policy custom với các quyền:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "ecr:*",
        "elasticloadbalancing:*",
        "codepipeline:*",
        "codebuild:*",
        "codedeploy:*",
        "iam:*",
        "logs:*",
        "cloudwatch:*",
        "sns:*",
        "s3:*",
        "dynamodb:*",
        "secretsmanager:*",
        "codestar-connections:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Sau khi setup

Báo lại cho tôi:
1. **Region** bạn đang dùng (vd: `ap-southeast-1`).
2. **Account ID** (12 chữ số).
3. Có sẵn **VPC + subnets** public/private chưa, hay cần tôi tạo mới trong Terraform?

Tôi sẽ cập nhật `variables.tf` và `terraform.tfvars.example` phù hợp với môi trường của bạn.
