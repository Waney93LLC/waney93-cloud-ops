import { AwsCiCdBootstrapProcess } from './aws/processes/bootstrap.process';


/**
 * Interface for encapsulating cloud services so they can be exposed to the orchestration layer without exposing the underlying implementation details.
 * This allows for flexibility in swapping out cloud providers or services without affecting the orchestration layer.
 */

export type Cloud = 'aws' | 'azure' | 'gcp';

export interface IPlatformOperations {
  cloud: Cloud;

  awsBootstrap?: AwsCiCdBootstrapProcess;
  azureBootstrap?: { run(): Promise<void> };
  gcpBootstrap?: { run(): Promise<void> };
}

export type ProcessMap = Record<Cloud, () => Promise<void>>;

/**
 * Config type defines the structure of the configuration object that will be used to initialize cloud services.
 */
export type Config = {
  AWS_REGION: string;
  AWS_PROFILE: string;
  CODESTARE_CONNECTION_ARN?: string;
};

export interface KeyValueStore {
  put(
    key: string,
    value: string,
    opts?: { contentType?: 'String' | 'SecureString'; description?: string },
  ): Promise<void>;

  get?(key: string): Promise<string | undefined>;
}

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