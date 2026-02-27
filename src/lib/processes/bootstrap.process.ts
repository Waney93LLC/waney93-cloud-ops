import { SSMClient } from '@aws-sdk/client-ssm';
import { buildClient } from '../aws/client-factory';
import { SsmService } from '../aws/ssm.service';
import { CredentialOps, getConfig } from '../config/environment-config';

/**
 * BootstrapProcess provides the necessary setup for the cloud platform, such as initializing clients, loading configuration, and preparing any required resources before running the CICD pipeline.
 */
export class BootstrapProcess {
  private async main(): Promise<void> {
    const { AWS_PROFILE, AWS_REGION, CODESTARE_CONNECTION_ARN } = getConfig();
    const credOps = new CredentialOps();
    const creds = await credOps.getLocalCredentials(AWS_PROFILE);
   
    const ssmSrvc = new SsmService(buildClient(SSMClient, AWS_REGION, creds));
    if(CODESTARE_CONNECTION_ARN) {
         await ssmSrvc.createParameter(
           '/waney93/shared/codestar/connection-arn',
           CODESTARE_CONNECTION_ARN,
           'String',
         );
    }


  }
  public static run(): void {
    const instance = new BootstrapProcess();
    instance.main().catch((error) => {
      console.error('Error executing Bootstrap process:', error);
      process.exit(1);
    });
  }
}
