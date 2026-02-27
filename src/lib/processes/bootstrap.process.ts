import { SSMClient } from '@aws-sdk/client-ssm';
import { buildClient } from '../aws/client-factory';
import { SsmService } from '../aws/ssm.service';
import { CredentialOps, getConfig } from '../config/environment-config';

/**
 * BootstrapProcess provides the necessary setup for the cloud platform, such as initializing clients, loading configuration, and preparing any required resources before running the CICD pipeline.
 */
export class BootstrapProcess {
  private async main(): Promise<void> {
    const { AWS_PROFILE, AWS_REGION } = getConfig();
    const credOps = new CredentialOps();
    const creds = await credOps.getLocalCredentials(AWS_PROFILE);
    const region = AWS_REGION;
    const ssmSrvc = new SsmService(buildClient(SSMClient, region, creds));
  }
  public static run(): void {
    const instance = new BootstrapProcess();
    instance.main().catch((error) => {
      console.error('Error executing Bootstrap process:', error);
      process.exit(1);
    });
  }
}
