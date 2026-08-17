import { defineBackend } from '@aws-amplify/backend';
import { Aspects, IAspect } from 'aws-cdk-lib';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Effect, FederatedPrincipal, Policy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { IConstruct } from 'constructs';
import { auth } from './auth/resource';
import { secondaryStorage, storage } from './storage/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  storage,
  secondaryStorage,
});

// Do not override cfnBucket.bucketName here. S3 bucket names are globally unique,
// and Amplify's generated physical names avoid collisions during deployments.

class GeneratedNodeRuntime implements IAspect {
  visit(node: IConstruct) {
    if (
      node instanceof CfnFunction &&
      (node.runtime === 'nodejs18.x' || node.node.path.includes('AmplifyBranchLinker'))
    ) {
      node.runtime = 'nodejs24.x';
    }
  }
}

Aspects.of(backend.stack).add(new GeneratedNodeRuntime());

const expedientesBucket = backend.secondaryStorage.resources.bucket;
const expedientesKmsKeyArn = 'arn:aws:kms:us-east-1:953290282809:key/e0b3229c-c603-4e8f-9157-8abbed28943f';
const expedientesCfnBucket = expedientesBucket.node.defaultChild as CfnBucket;

expedientesCfnBucket.bucketEncryption = {
  serverSideEncryptionConfiguration: [
    {
      serverSideEncryptionByDefault: {
        sseAlgorithm: 'aws:kms',
        kmsMasterKeyId: expedientesKmsKeyArn,
      },
    },
  ],
};

const expedientesAccessStack = backend.createStack('expedientesAccess');
const expedientesKmsKey = Key.fromKeyArn(
  expedientesAccessStack,
  'ExpedientesKmsKey',
  expedientesKmsKeyArn
);
const gexpedientesGroupName = 'gexpedientes';
const privateIdentityPrefix = 'privado/${cognito-identity.amazonaws.com:sub}';

// Storage group rules replace {entity_id} with a wildcard. Keep the owner-scoped
// storage output and enforce the gexpedientes gate from a separate stack. The
// Cognito group already exists in the deployed User Pool, so link it to this
// role instead of asking CloudFormation to create the group again.
const gexpedientesRole = new Role(expedientesAccessStack, 'GExpedientesGroupRole', {
  assumedBy: new FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: {
        'cognito-identity.amazonaws.com:aud': backend.auth.resources.identityPoolId,
      },
      'ForAnyValue:StringLike': {
        'cognito-identity.amazonaws.com:amr': 'authenticated',
      },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
});

expedientesKmsKey.grantEncryptDecrypt(gexpedientesRole);

const linkGExpedientesGroupRoleCall = {
  service: 'cognito-identity-provider',
  action: 'UpdateGroup',
  parameters: {
    GroupName: gexpedientesGroupName,
    UserPoolId: backend.auth.resources.userPool.userPoolId,
    RoleArn: gexpedientesRole.roleArn,
    Precedence: 2,
  },
  physicalResourceId: PhysicalResourceId.of('gexpedientes-group-role-link'),
};

new AwsCustomResource(expedientesAccessStack, 'LinkGExpedientesGroupRole', {
  onCreate: linkGExpedientesGroupRoleCall,
  onUpdate: linkGExpedientesGroupRoleCall,
  installLatestAwsSdk: false,
  policy: AwsCustomResourcePolicy.fromStatements([
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['cognito-idp:UpdateGroup'],
      resources: [backend.auth.resources.userPool.userPoolArn],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iam:PassRole'],
      resources: [gexpedientesRole.roleArn],
    }),
  ]),
});

new Policy(expedientesAccessStack, 'GExpedientesPrivateFolderAccess', {
  roles: [gexpedientesRole],
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${expedientesBucket.bucketArn}/${privateIdentityPrefix}/*`],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [expedientesBucket.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': [`${privateIdentityPrefix}/*`, `${privateIdentityPrefix}/`],
        },
      },
    }),
  ],
});

new Policy(expedientesAccessStack, 'AuthenticatedPrivateFolderDeny', {
  roles: [backend.auth.resources.authenticatedUserIamRole],
  statements: [
    new PolicyStatement({
      effect: Effect.DENY,
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${expedientesBucket.bucketArn}/privado/*`],
    }),
    new PolicyStatement({
      effect: Effect.DENY,
      actions: ['s3:ListBucket'],
      resources: [expedientesBucket.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': ['privado/*', 'privado/'],
        },
      },
    }),
  ],
});

const { cfnUserPool } = backend.auth.resources.cfnResources;

cfnUserPool.adminCreateUserConfig = {
  ...cfnUserPool.adminCreateUserConfig,
  allowAdminCreateUserOnly: true,
};
