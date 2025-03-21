# Amplify Storage Browser CDK Infrastructure

This CDK project deploys the backend infrastructure for the Amplify Storage Browser with Azure AD Authentication sample application.

## Infrastructure Overview

The CDK code deploys two stacks:

1. **S3AccessGrantStack**: Creates an S3 bucket and configures Access Grants
   - Creates an S3 bucket with CORS configuration
   - Creates an IAM role for Access Grants
   - Sets up an Access Grants instance
   - Configures Access Grants location and permissions

2. **LambdaStack**: Creates an API Gateway and Lambda function for token exchange
   - Creates a Lambda function that exchanges Azure AD tokens for AWS credentials
   - Sets up an API Gateway endpoint with CORS support
   - Configures IAM roles and policies for secure token exchange

## Deployment Instructions

### Prerequisites
- AWS CDK v2 installed globally (`npm install -g aws-cdk`)
- Node.js (v16+)
- An AWS account with permissions to create the required resources
- An Azure AD tenant with an application registration

### Steps to Deploy

1. Install dependencies:
```bash
npm install
```

2. Bootstrap CDK (if not already done):
```bash
cdk bootstrap
```

3. Deploy the S3AccessGrantStack:
```bash
cdk deploy sample-S3AccessGrantStack --context idcArn=arn:aws:iam::aws:identity-center --context idcUserId=your-idc-user-id --context bucketName=your-bucket-name
```

4. Deploy the LambdaStack:
```bash
cdk deploy sample-LambdaStack --context accountId=your-aws-account-id --context region=us-east-1 --context idcAppArn=your-idc-app-arn --context trustedTokenIssuerJwksEndpoint=https://login.microsoftonline.com/common/discovery/v2.0/keys
```

## Required Context Parameters

### S3AccessGrantStack
- `idcArn`: ARN of your AWS IAM Identity Center
- `idcUserId`: Your IAM Identity Center user ID
- `bucketName`: Name for the S3 bucket to be created

### LambdaStack
- `accountId`: Your AWS account ID
- `region`: AWS region to deploy to (e.g., us-east-1)
- `idcAppArn`: ARN of your IAM Identity Center application
- `trustedTokenIssuerJwksEndpoint`: JWKS endpoint for Azure AD token validation

## Useful Commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
