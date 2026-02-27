import { Config } from '../types';
import { fromIni } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentity } from '@aws-sdk/types';

export function getConfig(): Config {
  const [, , ...args] = process.argv;
  if (args.length < 1) {
    throw new Error(
      "Account profile and region are required as command-line arguments (e.g., 'npm start -- profile=userprofile region=us-east-2')",
    );
  }
  const config: Config = {
    AWS_PROFILE: '',
    AWS_REGION: '',
  };
  args.forEach((arg) => {
    const [key, value] = arg.split('=');
    config[key as keyof Config] = value;
  });
  if (!config.AWS_PROFILE || !config.AWS_REGION) {
    throw new Error(
      'Both profile and region must be provided as command-line arguments.',
    );
  }
  return config;
}


/**
 * This is the credential operations module which will allow to
 * manage AWS credentials such as assuming roles, refreshing tokens, etc.
 */
export class CredentialOps {
  //Getting local credentials from default profile
  async getLocalCredentials(profile: string): Promise<AwsCredentialIdentity> {
    const baseCreds = fromIni({ profile: profile });
    const c: AwsCredentialIdentity = await baseCreds();
    if (!c.accessKeyId || !c.secretAccessKey) {
      throw new Error('No usable credentials found');
    }
    return c;
  }
}
