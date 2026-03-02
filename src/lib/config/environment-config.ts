import { Config } from '../types';
import { fromIni } from '@aws-sdk/credential-providers';
import { AwsCredentialIdentity } from '@aws-sdk/types';
import * as fs from 'fs';
import * as path from 'path';

export function getConfig(envFileName: string): Config {
  if (!envFileName) {
    throw new Error('Environment file name is required (e.g. dev.json)');
  }

  const filePath = path.resolve(process.cwd(), 'src/lib/config', envFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  let parsed: unknown;

  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    throw new Error(`Invalid JSON in environment file: ${envFileName}`);
  }

  const config = parsed as Config;

  if (!config.AWS_PROFILE || !config.AWS_REGION) {
    throw new Error(
      `Environment file ${envFileName} must contain AWS_PROFILE and AWS_REGION`,
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
