import { SSMClient } from '@aws-sdk/client-ssm';
import { buildClient } from '../client-factory';
import { SsmService } from '../services/ssm.service';
import { CredentialOps, getConfig } from '../../config/environment-config';
import { BootstrapStep } from '../../types';
import { EnsureCodestarArnStep } from '../../orchestrators/steps';
import { BootstrapRunner } from '../../orchestrators/runners';

/**
 * BootstrapProcess provides the necessary setup for the cloud platform, such as initializing clients, loading configuration, and preparing any required resources before running the CICD pipeline.
 */
export class AwsCiCdBootstrapProcess {
  private async main(): Promise<void> {
    const { AWS_PROFILE, AWS_REGION, CODESTARE_CONNECTION_ARN } = getConfig();
    const credOps = new CredentialOps();
    const creds = await credOps.getLocalCredentials(AWS_PROFILE);

    const ssmSrvc = new SsmService(buildClient(SSMClient, AWS_REGION, creds));
    const steps: BootstrapStep[] = [];

    if (CODESTARE_CONNECTION_ARN) {
      steps.push(
        new EnsureCodestarArnStep(
          ssmSrvc,
          '/waney93/shared/codestar/connection-arn',
          CODESTARE_CONNECTION_ARN,
        ),
      );
    }

    const runner = new BootstrapRunner(steps);
    await runner.run({
      log: console,
    });
  }

  public run(): void {
    const instance = new AwsCiCdBootstrapProcess();
    instance.main().catch((error) => {
      console.error('Error executing Bootstrap process:', error);
      process.exit(1);
    });
  }
}
