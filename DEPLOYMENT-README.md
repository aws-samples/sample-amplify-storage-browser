# Onboarding Data Uploader - aa-stack Integration Guide

This guide shows how to integrate the AdvisorAI Onboarding Data Uploader as a second Amplify app in the existing tenant aa-stack CloudFormation deployment.

## 🏗️ **Architecture Overview**

The onboarding data uploader is deployed as a **second Amplify app** alongside the main AdvisorAI application within the same aa-stack CloudFormation template.

## 📁 **What This Creates**

### S3 Folder Structure
- **`data/`** - Shared workspace for onboarding files (both user groups have full access)
- **`admin/`** - Internal team management files (AdvisorAI admins only)
- **`archive/`** - Completed onboarding data (AdvisorAI admins only)

### User Groups
- **`onboarding-data-admins`** - Full access to all folders (AdvisorAI staff)
- **`onboarding-data-users`** - Access only to the shared `data/` folder (Institution admins)

### Security Model
- ✅ Only users in these two groups can access the S3 Browser
- ✅ Regular Cognito users (not in groups) are denied access
- ✅ No public or unauthenticated access

## 🚀 **Integration Steps**

### Step 1: Deploy aa-stack

Deploy the [aa-stack](https://github.com/Advisor-AI-Inc/advisorai-stack) CloudFormation template as per usual.

### Step 2: Add Users to the relevant Cognito Groups

Use the AWS Console or CLI to add users to the appropriate groups:

```bash
# Add user to admins group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <user-pool-id> \
  --username admin@company.com \
  --group-name onboarding-data-admins

# Add user to users group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <user-pool-id> \
  --username user@company.com \
  --group-name onboarding-data-users
```

## 🔧 **Local Development**

For local development, you can still use the Amplify sandbox:

```bash
# Set up environment variables for local development
export COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
export COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
export COGNITO_IDENTITY_POOL_ID=us-west-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export COGNITO_AUTH_ROLE_ARN=arn:aws:iam::123456789012:role/...
export COGNITO_UNAUTH_ROLE_ARN=arn:aws:iam::123456789012:role/...

# Start local development
npm run dev
```

## 📋 **Required aa-stack Resources**

The aa-stack CloudFormation template must have these existing resources:

- **`userPool`** - Cognito User Pool
- **`identityPool`** - Cognito Identity Pool
- **`identityPoolAuthRole`** - IAM role for authenticated users
- **`identityPoolUnauthRole`** - IAM role for unauthenticated users
- **`roleAmplifyServiceRole`** - Amplify service role

## 🌐 **Accessing the Application**

Once deployed, the onboarding data uploader will be available at:
```
https://<branch>.<app-id>.amplifyapp.com
```

You can find the exact URL in the CloudFormation outputs:
- `amplifyAppOnboardingDataUploaderUrl`