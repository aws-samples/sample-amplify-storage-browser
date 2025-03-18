/* eslint-disable no-useless-escape */
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import {
  ArnPrincipal,
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { join } from "path";

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const accountId = this.node.tryGetContext("accountId");
    const region = this.node.tryGetContext("region");
    const idcAppArn = this.node.tryGetContext("idcAppArn");
    const ttiJwksEndpoint = this.node.tryGetContext(
      "trustedTokenIssuerJwksEndpoint"
    );

    // 1. Create Identity Bearer Role that provides access to AGs
    // lambda returns creds for this role
    const accessGrantPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["*"],
      resources: [`arn:aws:s3:${region}:${accountId}:access-grants/default`],
    });

    const identityBearerRole = new Role(this, "SbIdentityBearerRole", {
      roleName: "SbIdentityBearerRole",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });

    identityBearerRole.addToPolicy(accessGrantPolicy);

    const lambda = new NodejsFunction(this, "TokenExchangeLambda", {
      entry: join(__dirname, "lambda", "handler.ts"),
      environment: {
        REGION: region,
        IDP_APP_ARN: idcAppArn,
        IDENTITY_BEARER_ROLE_ARN: identityBearerRole.roleArn,
        TTI_JWKS_URI: ttiJwksEndpoint,
      },
    });

    const lambdaDefaultRoleArn = lambda.role?.roleArn; // get default lambda role

    identityBearerRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ArnPrincipal(lambdaDefaultRoleArn!)],
        actions: ["sts:AssumeRole", "sts:SetContext"],
      })
    );

    // 2. add STS and SSO permissions to lambda
    lambda.addToRolePolicy(
      new PolicyStatement({
        sid: "CreateTokenWithIAMPolicy",
        effect: Effect.ALLOW,
        actions: ["sso-oauth:CreateTokenWithIAM"],
        resources: ["*"], // Note: You should restrict this in production
      })
    );

    lambda.addToRolePolicy(
      new PolicyStatement({
        sid: "AssumeRolePolicy",
        effect: Effect.ALLOW,
        actions: ["sts:AssumeRole", "sts:SetContext"],
        resources: [identityBearerRole.roleArn],
      })
    );

    // Define the API Gateway resource
    const api = new apigateway.RestApi(this, "TokenExchangeApi", {
      restApiName: "Token exchange",
      description: "API that takes IDP idToken to get IAM creds",
      // Default CORS settings
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Authorization", "Content-Type", "X-Idtoken"], // Add X-Idtoken header to allowed headers
      },
    });

    // Create a resource for token exchange
    const resource = api.root.addResource("exchange");

    // Create Method that passes the idToken from header to the Lambda function
    resource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(lambda, {
        proxy: false,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
        // Pass headers to Lambda through request template
        requestTemplates: {
          "application/json": JSON.stringify({
            idToken: "$util.escapeJavaScript($input.params('X-Idtoken'))",
            path: "$context.path",
            httpMethod: "$context.httpMethod",
          }),
        },
        integrationResponses: [{ statusCode: "200" }, { statusCode: "400" }],
      }),
      {
        requestParameters: {
          "method.request.header.X-Idtoken": true, // Makes the X-Idtoken header required
        },
        requestValidatorOptions: {
          requestValidatorName: "idTokenValidator",
          validateRequestParameters: true,
        },
        methodResponses: [{ statusCode: "200" }, { statusCode: "400" }],
      }
    );

    // Output the API Gateway URL
    new CfnOutput(this, "ApigwUrl", {
      value: api.urlForPath("/exchange"),
      description: "URL of the API endpoint",
    });
  }
}
