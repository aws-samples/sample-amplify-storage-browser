import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import {
  Bucket,
  CfnAccessGrantsInstance,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import {
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { S3AccessGrant } from "./access-grant";

export class S3AccessGrantStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const idcArn = this.node.tryGetContext("idcArn");
    const idcUserId = this.node.tryGetContext("idcUserId");
    const bucketName = this.node.tryGetContext("bucketName");

    // 0. Create AG instance if you do not have one already
    new CfnAccessGrantsInstance(
      this,
      "AccessGrantsInstance",
      {
        identityCenterArn: idcArn,
      }
    );

    // 1. Create a new s3 bucket.
    // If you want to use an existing s3 bucket within access grant instance, comment off the following variable
    const bucket = new Bucket(this, "Bucket", {
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      cors: [
        {
          id: "S3CORSRuleId1",
          allowedHeaders: ["*"],
          allowedMethods: [
            HttpMethods.GET,
            HttpMethods.HEAD,
            HttpMethods.PUT,
            HttpMethods.POST,
            HttpMethods.DELETE,
          ],
          allowedOrigins: ["*"], // Note: You should restrict this in production
          exposedHeaders: [ // source of truth: https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3config-storagebrowser.html
            "last-modified",
            "content-type",
            "content-length",
            "etag",
            "x-amz-version-id",
            "x-amz-request-id",
            "x-amz-id-2",
            "x-amz-cf-id",
            "x-amz-storage-class",
            "date",
            "access-control-expose-headers"
          ],
          maxAge: 3000,
        },
      ],
    });

    // 2. Create an IAM role to be associated with the Access Grants Location
    // If you want to re-purpose an existing , comment of the following variable accessGrantS3LocationRole
    const accessGrantS3LocationRole = new Role(
      this,
      "AccessGrantS3LocationRole",
      {
        assumedBy: new ServicePrincipal("access-grants.s3.amazonaws.com"),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        ],
      }
    );
    accessGrantS3LocationRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("access-grants.s3.amazonaws.com")],
        actions: ["sts:AssumeRole", "sts:SetContext", "sts:SetSourceIdentity"],
      })
    );

    // Call S3AccessGrant construct to define a location and permission to be associated for that location for an user
    new S3AccessGrant(this, "MyAccessGrant1", {
      iamRoleArn: accessGrantS3LocationRole.roleArn,
      bucketName: bucket.bucketName,
      idcUserId: idcUserId,
      permission: "READWRITE"
    })
  }
}