import { SSMClient } from '@aws-sdk/client-ssm';
import { buildClient } from '../client-factory';
import { SsmService } from '../services/ssm.service';
import { CredentialOps, getConfig } from '../../config/environment-config';
import { BootstrapStep, IBootstrapProcess } from '../../types';
import {
  EnsureCognitoCertStep,
  EnsureConfigValueStep,
} from '../../orchestrators/steps/bootstrap-steps';
import { BootstrapRunner } from '../../orchestrators/runners';
import { Route53Service } from '../services/route53.service';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ACMClient } from '@aws-sdk/client-acm';
import { AcmService } from '../services/acm.service';

/**
 * BootstrapProcess provides the necessary setup for the cloud platform, such as initializing clients, loading configuration, and preparing any required resources before running the CICD pipeline.
 */
export class AwsCiCdBootstrapProcess implements IBootstrapProcess {
  private async main(): Promise<void> {
    const [, , ...args] = process.argv;
    const filename = args[0] || 'dev.json';
    const {
      AWS_PROFILE,
      AWS_REGION,
      CODESTARE_CONNECTION_ARN,
      PIPELINE_NOTIFICATION_EMAIL,
      AWS_MANAGER_PROFILE,
      COGNITO,
    } = getConfig(filename);
    const credOps = new CredentialOps();
    const creds = await credOps.getLocalCredentials(AWS_PROFILE);
    const managerCreds = await credOps.getLocalCredentials(
      AWS_MANAGER_PROFILE || AWS_PROFILE,
    );

    const ssmSrvc = new SsmService(buildClient(SSMClient, AWS_REGION, creds));
    const route53Srvc = new Route53Service(
      buildClient(Route53Client, AWS_REGION, managerCreds),
    );
    const acmSvc = new AcmService(buildClient(ACMClient, AWS_REGION, creds));
    const steps: BootstrapStep[] = [];

    if (CODESTARE_CONNECTION_ARN) {
      steps.push(
        new EnsureConfigValueStep(ssmSrvc, {
          envVar: CODESTARE_CONNECTION_ARN,
          key: '/waney93/shared/codestar/connection-arn',
          description: 'CodeStar connection ARN',
        }),
      );
    }

    if (PIPELINE_NOTIFICATION_EMAIL) {
      steps.push(
        new EnsureConfigValueStep(ssmSrvc, {
          envVar: PIPELINE_NOTIFICATION_EMAIL,
          key: '/waney93/shared/notifications/email',
          description: 'Pipeline notification email',
        }),
      );
    }

    if (COGNITO) {
      steps.push(
        new EnsureCognitoCertStep({
          acm: acmSvc,
          route53: route53Srvc,
          ssmSrvc,
          authDomain: COGNITO.AUTH_DOMAIN,
          certArnParameterName: COGNITO.CERT_ARN_PARAMETER_NAME,
        }),
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
