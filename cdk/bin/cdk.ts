#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack';
import { S3AccessGrantStack } from '../lib/access-grants-stack';

const app = new cdk.App();

new LambdaStack(app, "sample-LambdaStack", {});
new S3AccessGrantStack(app, "sample-S3AccessGrantStack", {});