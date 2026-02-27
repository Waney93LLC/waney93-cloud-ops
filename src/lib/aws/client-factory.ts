import type { AwsCredentialIdentity } from '@aws-sdk/types';

/**
 * Generic AWS SDK v3 client builder.
 *
 * Usage:
 *   const cfn = buildClient(CloudFormationClient, region, creds);
 */
export function buildClient<TClient>(
  ClientCtor: new (args: any) => TClient,
  region: string,
  creds: AwsCredentialIdentity,
): TClient {
  return new ClientCtor({
    region,
    credentials: creds,
  });
}
