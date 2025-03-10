/* eslint-disable @typescript-eslint/ban-ts-comment */
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { storage, secondaryStorage } from "./storage/resource";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  storage,
  secondaryStorage,
});

// NOTE: as a prerequisite create customBucket below with folders `public` and `admin`
const customBucketName = "my-existing-bucket-ash";

backend.addOutput({
  version: "1.3",
  storage: {
    buckets: [
      {
        name: customBucketName,
        bucket_name: customBucketName,
        aws_region: "us-east-2",
        //@ts-ignore
        paths: {
          "public/*": {
            guest: ["get", "list"],
            authenticated: ["get", "list", "write", "delete"],
          },
          "admin/*": {
            groupsadmin: ["get", "list", "write", "delete"],
            authenticated: ["get", "list", "write"],
          },
        },
      },
    ],
  },
});

// Define an inline policy to attach to Amplify's un-auth role
// This policy defines how unauthenticated users can access your existing bucket

const unauthPolicy = new Policy(backend.stack, "customBucketUnauthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject"],
      resources: [`arn:aws:s3:::${customBucketName}/public/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [`arn:aws:s3:::${customBucketName}`],
      conditions: {
        StringLike: {
          "s3:prefix": ["public/*", "public/"],
        },
      },
    }),
  ],
});

// Define an inline policy to attach to Amplify's auth role
// This policy defines how authenticated users can access your existing bucket
const authPolicy = new Policy(backend.stack, "customBucketAuthPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [
        `arn:aws:s3:::${customBucketName}/public/*`,
        `arn:aws:s3:::${customBucketName}/admin/*`,
      ],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [`arn:aws:s3:::${customBucketName}`],
      conditions: {
        StringLike: {
          "s3:prefix": ["public/*", "public/", "admin/*", "admin/"],
        },
      },
    }),
  ],
});

// Add the policies to the unauthenticated user role
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(
  unauthPolicy
);
// Add the policies to the authenticated user role
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(authPolicy);
