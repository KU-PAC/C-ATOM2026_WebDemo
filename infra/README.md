# Terraform (S3 + CloudFront)

このディレクトリは、静的サイト配信用の AWS インフラを Terraform で管理します。

## 作成される主なリソース

- S3 バケット（配信アセット格納）
- CloudFront ディストリビューション
- CloudFront Function（拡張子なし URL の `index.html` リライト）

## 公開リポジトリ運用ルール

- 実値は `*.tfvars` と `backend.hcl` に置き、コミットしない
- テンプレートは `terraform.tfvars.example` と `backend.hcl.example` を使う

## 初期セットアップ

1. `backend.hcl.example` を `backend.hcl` にコピーして値を埋める
2. `terraform.tfvars.example` を `terraform.tfvars` にコピーして値を埋める

```bash
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
```

## デプロイ手順

```bash
terraform init -backend-config=backend.hcl
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

## 出力

- `cloudfront_domain_name`
- `cloudfront_distribution_id`
- `website_bucket_name`

## 補足

- カスタムドメインを使う場合は `public_domain` と `acm_certificate_arn` を両方指定
- 使わない場合は両方未指定（`null`）
