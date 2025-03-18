#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack';
import { S3AccessGrantStack } from '../lib/access-grants-stack';

const app = new cdk.App();

// Validate required context parameters
const requiredParams = ["idcArn", "idcUserId", "bucketName", "region", "accountId", "idcAppArn", "trustedTokenIssuerJwksEndpoint"];
const missingParams: string[] = [];

for (const param of requiredParams) {
  if (!app.node.tryGetContext(param)) {
    missingParams.push(param);
  }
}

if (missingParams.length > 0) {
  throw new Error(`Missing required context parameters: ${missingParams.join(', ')}`);
}

new LambdaStack(app, "sample-LambdaStack", {});
new S3AccessGrantStack(app, "sample-S3AccessGrantStack", {});