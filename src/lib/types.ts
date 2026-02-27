import { SsmService } from "./aws/ssm.service";


/**
 * Interface for encapsulating cloud services so they can be exposed to the orchestration layer without exposing the underlying implementation details.
 * This allows for flexibility in swapping out cloud providers or services without affecting the orchestration layer.
 */
export interface ICloudServices {
  ssmService?: SsmService;
}

/**
 * Config type defines the structure of the configuration object that will be used to initialize cloud services.
 */
export type Config = {
  AWS_REGION: string;
  AWS_PROFILE: string;
};
