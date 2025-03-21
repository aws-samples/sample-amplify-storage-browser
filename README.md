# Amplify Storage Browser with Azure AD Authentication

This project demonstrates how to build a secure web application that allows users to browse and manage S3 buckets using Storage Browser with Azure AD for authentication and AWS IAM Access Grants for authorization.

## Overview

The application consists of two main components:

1. **Frontend**: A React+Vite application that provides a UI for authentication with Azure AD and for browsing S3 buckets.
2. **Backend**: AWS CDK infrastructure that sets up API Gateway, Lambda, and S3 Access Grants

## Features

- Single Sign-On with Azure AD (Microsoft Entra ID)
- Secure token exchange via API Gateway and Lambda
- Fine-grained access control with S3 Access Grants
- Responsive UI with AWS Amplify Storage Browser component

## Prerequisites

- Node.js (v16+)
- AWS CDK v2 installed globally (`npm install -g aws-cdk`)
- An Azure AD tenant with an application registration
- An AWS account with permissions to create the required resources

## Getting Started

### 1. Clone the Repository

This command clones the `sample/managed-auth-entra` branch from the repository, which contains the sample implementation for authentication using Microsoft Entra ID.

```bash
git clone -b sample/managed-auth-entra https://github.com/yourusername/sample-amplify-storage-browser.git
cd sample-amplify-storage-browser
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install CDK dependencies
cd cdk
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AWS_REGION=your-aws-region
VITE_AWS_ACCOUNT_ID=your-aws-account-id
VITE_APIGW_URL=https://<your-api-gateway-url>/exchange
```

### 4. Deploy the CDK Infrastructure

The CDK code deploys two stacks:

1. **S3AccessGrantStack**: Creates an S3 bucket and configures Access Grants
2. **LambdaStack**: Creates an API Gateway and Lambda function for token exchange

```bash
cd cdk

# Bootstrap CDK (if not already done)
cdk bootstrap

# Deploy the stacks with required context parameters
cdk deploy sample-S3AccessGrantStack --context idcArn=arn:aws:iam::aws:identity-center --context idcUserId=your-idc-user-id --context bucketName=your-bucket-name

cdk deploy sample-LambdaStack --context accountId=your-aws-account-id --context region=us-east-1 --context idcAppArn=your-idc-app-arn --context trustedTokenIssuerJwksEndpoint=https://login.microsoftonline.com/common/discovery/v2.0/keys
```

### 5. Run the Frontend Application

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser to access the application.

## CDK Infrastructure Details

### S3AccessGrantStack

This stack sets up the S3 bucket and configures Access Grants:

- Creates an S3 bucket with CORS configuration
- Creates an IAM role for Access Grants
- Sets up an Access Grants instance
- Configures Access Grants location and permissions

### LambdaStack

This stack creates the API Gateway and Lambda function for token exchange:

- Creates a Lambda function that exchanges Azure AD tokens for AWS credentials
- Sets up an API Gateway endpoint with CORS support
- Configures IAM roles and policies for secure token exchange

## Frontend Application Details

The frontend is a React application built with Vite that uses:

- Azure MSAL for authentication with Azure AD
- Amplify Storage Browser UI component for the accessing S3 

Key components:
- `src/App.tsx`: Main application component
- `src/components/Home.tsx`: Home page with Storage Browser
- `src/components/Login.tsx`: Login page
- `src/services/auth.ts`: Authentication service

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

