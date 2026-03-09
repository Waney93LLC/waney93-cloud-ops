import { AwsCiCdBootstrapProcess } from './aws/processes/bootstrap';
import { CertificateSummary } from '@aws-sdk/client-acm';
import { HostedZone } from '@aws-sdk/client-route-53';
import { AcmService } from './aws/services/acm.service';
import { Route53Service } from './aws/services/route53.service';

/**
 * Interface for encapsulating cloud services so they can be exposed to the orchestration layer without exposing the underlying implementation details.
 * This allows for flexibility in swapping out cloud providers or services without affecting the orchestration layer.
 */

export type Cloud = 'aws' | 'azure' | 'gcp';

export interface IPlatformOperations {
  cloud: Cloud;

  awsBootstrap?: IBootstrapProcess;
  azureBootstrap?: IBootstrapProcess;
  gcpBootstrap?: IBootstrapProcess;
}

export interface IBootstrapProcess{
  run(): void;
}

export type ProcessMap = Record<Cloud, () => Promise<void>>;

export type SsmConfigParameter = {
  envVal: string | undefined;
  key: string;
  description: string;
};

/**
 * Config type defines the structure of the configuration object that will be used to initialize cloud services.
 */
export type Config = {
  AWS_REGION: string;
  AWS_PROFILE: string;
  AWS_MANAGER_PROFILE?: string;
  configParameters: SsmConfigParameter[];
  COGNITO?: {
    AUTH_DOMAIN: string;
    CERT_ARN_PARAMETER_NAME: string;
  };
};

export interface KeyValueStore {
  put(
    key: string,
    value: string,
    opts?: { contentType?: 'String' | 'SecureString'; description?: string },
  ): Promise<void>;

  get?(key: string): Promise<string | undefined>;
}

export type RouteCertInventory = {
  certs: CertificateSummary[];
  zones: HostedZone[];
};

export interface BootstrapContext {
  log: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
}

export interface BootstrapStep {
  name: string;
  run(ctx: BootstrapContext): Promise<void>;
}

export interface EnsureConfigValueStepProps {
  envVar: string;
  key: string;
  description?: string;
  contentType?: 'String' | 'SecureString' | undefined;
}

export interface EnsureCognitoCertStepProps {
  acm: AcmService;
  route53: Route53Service;
  ssmSrvc: KeyValueStore;
  authDomain: string;
  certArnParameterName: string;
}
