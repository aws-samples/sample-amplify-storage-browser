import { Construct } from "constructs";
import {
    CfnAccessGrant,
    CfnAccessGrantsLocation,
  } from "aws-cdk-lib/aws-s3";

interface S3AccessGrantProps {
    bucketName: string;
    iamRoleArn: string;
    idcUserId: string;
    permission: string;
}

export class S3AccessGrant extends Construct {
    constructor(scope: Construct, id: string, props: S3AccessGrantProps) {
        super(scope, id);

        const accessGrantsLocation = new CfnAccessGrantsLocation(
            this,
            "AccessGrantsLocation",
            {
            iamRoleArn: props.iamRoleArn,
            locationScope: `s3://${props.bucketName}/*`,
            tags: [
                {
                key: "Purpose",
                value: "AccessGrantLocation",
                },
            ],
            }
        );
    
        new CfnAccessGrant(this, id, {
            accessGrantsLocationId: accessGrantsLocation.ref,
            grantee: {
            granteeIdentifier: props.idcUserId,
            granteeType: "DIRECTORY_USER",
            },
            permission: props.permission,
        });
    }
}