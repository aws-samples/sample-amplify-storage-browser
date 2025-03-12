import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { Policy, PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
});

/**
 * Note: This code assumes the existence of an S3 bucket named 'my-existing-bucket'.
 * Replace 'my-existing-bucket' with your actual bucket name and adjust the paths and permissions as needed.
 * For more information on authorization access, visit: https://docs.amplify.aws/react/build-a-backend/storage/authorization/#available-actions
 *
 * Requirements for this sample:
 * 1. An S3 bucket named 'my-existing-bucket' must exist in your AWS account.
 * 2. The bucket should contain two folders:
 *    - 'public/' - Accessible by all authenticated and unauthenticated users.
 *    - 'admin/' - Accessible only by users in the admin group and authenticated users.
 *
 * Note: Ensure the bucket exists before deploying this code, as it only sets up IAM policies and does not create the S3 bucket.
 */
const customBucketName = "my-existing-bucket";

backend.addOutput({
  version: "1.3",
  storage: {
    aws_region: "us-east-1",
    bucket_name: customBucketName,
    buckets: [
      {
        name: customBucketName,
        bucket_name: customBucketName,
        aws_region: "us-east-1",
        //@ts-expect-error amplify backend type issue https://github.com/aws-amplify/amplify-backend/issues/2569
        paths: {
          "public/*": {
            guest: ["get", "list"],
            authenticated: ["get", "list", "write", "delete"],
          },
          "admin/*": {
            groupsadmin: ["get", "list", "write", "delete"],
            authenticated: ["get", "list", "write", "delete"],
          },
        },
      },
    ],
  },
});

/**
 * Define an inline policy to attach to Amplify's un-auth role
 * This policy defines how unauthenticated users can access your existing bucket
 */
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

/**
 * Define an inline policy to attach to Amplify's auth role
 * This policy defines how authenticated users can access your existing bucket
 */
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
      resources: [
        `arn:aws:s3:::${customBucketName}`,
        `arn:aws:s3:::${customBucketName}/*`,
      ],
      conditions: {
        StringLike: {
          "s3:prefix": ["public/*", "public/", "admin/*", "admin/"],
        },
      },
    }),
  ],
});

/**
 * Define an inline policy to attach to Admin user role
 * This policy defines how authenticated users can access your existing bucket
 */
const adminPolicy = new Policy(backend.stack, "customBucketAdminPolicy", {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      resources: [`arn:aws:s3:::${customBucketName}/admin/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:ListBucket"],
      resources: [
        `arn:aws:s3:::${customBucketName}`,
        `arn:aws:s3:::${customBucketName}/*`,
      ],
      conditions: {
        StringLike: {
          "s3:prefix": ["admin/*", "admin/"],
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

// Add the policies to the admin user role
backend.auth.resources.groups["admin"].role.attachInlinePolicy(adminPolicy);
