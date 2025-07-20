# AdvisorAI Onboarding Data Uploader

A secure, group-based file management system for onboarding data, built with AWS Amplify and React. Integrated as a second Amplify app within the AdvisorAI aa-stack CloudFormation deployment.

## 🎯 **Features**

- **🔐 Group-Based Access Control** - Two user groups with different access levels
- **📁 Organized Folder Structure** - Separate areas for different types of onboarding data
- **☁️ Cloud Storage** - Powered by AWS S3 with Amplify Storage
- **👥 Multi-Tenant Support** - Integrated with aa-stack tenant architecture
- **🚀 Modern UI** - Built with React and Amplify UI components

## 📁 **Folder Structure & Permissions**

### User Groups
- **`onboarding-data-admins`** - AdvisorAI staff with full access
- **`onboarding-data-users`** - Institution admins with limited access

### S3 Folder Access
| Folder | `onboarding-data-admins` | `onboarding-data-users` |
|--------|--------------------------|-------------------------|
| `data/` | ✅ Full access | ✅ Full access |
| `admin/` | ✅ Full access | ❌ No access |
| `archive/` | ✅ Full access | ❌ No access |

## 🏗️ **Architecture**

This application is deployed as a **second Amplify app** within the existing aa-stack CloudFormation template, providing:

- Shared Cognito User Pool and Identity Pool
- Unified deployment and management
- Automatic environment variable injection
- Consistent security and access controls

## 🚀 **Deployment**

See [DEPLOYMENT-README.md](./DEPLOYMENT-README.md) for complete integration instructions with the aa-stack CloudFormation template.

## 💻 **Local Development**

```bash
# Install dependencies
npm install

# Set up environment variables (get values from aa-stack outputs)
export COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
export COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
export COGNITO_IDENTITY_POOL_ID=us-west-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export COGNITO_AUTH_ROLE_ARN=arn:aws:iam::123456789012:role/...
export COGNITO_UNAUTH_ROLE_ARN=arn:aws:iam::123456789012:role/...

# Start development server
npm run dev
```

## 🔧 **Technology Stack**

- **Frontend**: React 19 + TypeScript + Vite
- **Authentication**: AWS Cognito (User Pool + Identity Pool)
- **Storage**: AWS S3 via Amplify Storage
- **UI Components**: Amplify UI React + Storage Browser
- **Deployment**: AWS Amplify + CloudFormation

## 📋 **Prerequisites**

- Existing aa-stack CloudFormation deployment
- AWS Cognito User Pool with appropriate groups
- GitHub access token for Amplify deployments

## 🔒 **Security Features**

- **Group-based access control** - Only authorized users can access files
- **No public access** - All access requires authentication
- **IAM role segregation** - Different permissions for different user groups
- **Secure authentication** - OAuth 2.0 flows with Cognito

## 📖 **Usage**

1. **Login** - Users authenticate with Cognito credentials
2. **Browse** - Navigate available folders based on group membership
3. **Upload** - Drag and drop files or use upload button
4. **Download** - Click to download files
5. **Delete** - Remove files as needed (with appropriate permissions)

The interface automatically shows only the folders and files the user has access to based on their group membership.

## 🎉 **What Users See**

- **Admins** (`onboarding-data-admins`) see all folders: `data/`, `admin/`, `archive/`
- **Users** (`onboarding-data-users`) see only: `data/`
- **Non-group members** get access denied errors

This ensures proper data segregation while maintaining a smooth user experience for authorized users.

---

For detailed deployment instructions, see [DEPLOYMENT-README.md](./DEPLOYMENT-README.md).
