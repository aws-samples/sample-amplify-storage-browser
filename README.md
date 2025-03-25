# Amplify Storage Browser React+Vite Starter Template

This repository provides a starter template for creating applications with Storage Browser for S3 using React+Vite and AWS Amplify, emphasizing easy setup for authentication and S3 capabilities.

## Overview

This template equips you with a foundational React application integrated with AWS Amplify Auth and Storage Browser, streamlined for scalability and performance. It is ideal for developers looking to jumpstart their Storage Browser project with pre-configured AWS services like Cognito and S3.

## Features

- **Authentication**: Setup with Amazon Cognito for secure user authentication with email login
- **Storage**: Configured with multiple S3 buckets and granular access controls. The sample is configured with
  - Default storage bucket with public, admin, and private access paths
  - Secondary storage bucket with separate backup paths.
  - More info on how to setup : https://docs.amplify.aws/react/build-a-backend/storage/set-up-storage/#building-your-storage-backend
- **UI Components**: Pre-integrated Amplify UI React components including:
  - Authenticator for sign-in/sign-up flows
  - Storage Browser for S3 file management

## Project Structure

```
├── amplify/                  # Amplify Gen 2 backend configuration
│   ├── auth/                 # Authentication configuration
│   ├── storage/              # S3 storage configuration
│   └── backend.ts            # Main backend definition
├── src/
│   ├── App.tsx               # Main application component
│   └── main.tsx              # Application entry point
└── package.json              # Project dependencies
```

## Storage Configuration

The project includes two S3 buckets with different access patterns:

1. **Default Storage Bucket**:
   - `public/*`: Read/write for guests, full access for authenticated users
   - `admin/*`: Full access for admin group, read-only for other authenticated users
   - `private/{entity_id}/*`: User-specific private storage

2. **Secondary Storage Bucket**:
   - `backup_public/*`: Read/write for guests, full access for authenticated users
   - `backup_admin/*`: Full access for admin group, read-only for other authenticated users
   - `backup_private/{entity_id}/*`: User-specific private storage

## Getting Started

### Installation

1. Clone this repository
   ```bash
   git clone <repository-url>
   cd sample-amplify-storage-browser
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Initialize and deploy the Amplify backend
   ```bash
   npx ampx sandbox
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

## Deploying to AWS

For detailed instructions on deploying your application, refer to the [deployment section](https://docs.amplify.aws/react/start/quickstart/#deploy-a-fullstack-app-to-aws) of our documentation.

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
