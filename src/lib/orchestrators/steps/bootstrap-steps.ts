import { AcmService } from '../../aws/services/acm.service';
import { Route53Service } from '../../aws/services/route53.service';
import {
  BootstrapContext,
  BootstrapStep,
  EnsureCognitoCertStepProps,
  EnsureConfigValueStepProps,
  KeyValueStore,
  RouteCertInventory,
} from '../../types';

export class EnsureConfigValueStep implements BootstrapStep {
  name = 'Ensure configuration value is stored';

  constructor(
    private readonly kv: KeyValueStore,
    private readonly props: EnsureConfigValueStepProps,
  ) {}

  async run(ctx: BootstrapContext): Promise<void> {
    const value = this.props.envVar;
    if (!value) {
      ctx.log.warn(`${this.props.envVar} not set; skipping.`);
      return;
    }

    await this.kv.put(this.props.key, value, {
      contentType: this.props.contentType || 'String',
      description:
        this.props.description ||
        `Stored by EnsureConfigValueStep for ${this.props.envVar}`,
    });
    ctx.log.info(`Stored ${this.props.envVar} at ${this.props.key}`);
  }
}

export class EnsureCognitoCertStep implements BootstrapStep {
  name = 'Ensure Cognito certificate is created and stored in SSM';

  constructor(private readonly props: EnsureCognitoCertStepProps) {}

  async run(ctx: BootstrapContext): Promise<void> {
    const inventory = await this.getInventory();
    const zoneId = this.getZoneId(inventory);
    await this.setCognitoCertificate(this.props.authDomain, zoneId);

    ctx.log.info(
      `Cognito certificate for ${this.props.authDomain} is set up and stored in SSM at ${this.props.certArnParameterName}`,
    );
  }

  private getZoneId(inventory: RouteCertInventory): string {
    const [zone] = inventory.zones;
    if (!zone) {
      throw new Error('No hosted zones found in inventory.');
    }
    const zoneID = zone.Id?.replace('/hostedzone/', '');
    if (!zoneID) {
      throw new Error(`Hosted zone ID is missing or invalid: ${zone.Id}`);
    }
    return zoneID;
  }

  private async getInventory(): Promise<RouteCertInventory> {
    const certs = await this.props.acm.listCertificates();
    const zones = await this.props.route53.listHostedZones();
    return {
      certs,
      zones,
    };
  }

  private async setCognitoCertificate(
    domain: string,
    hostedZoneId: string,
  ): Promise<void> {
    // Optional but recommended for safe retries (1–32 alphanumeric)
    const idempotencyToken = domain.replace(/\./g, '').slice(0, 32);

    const certArn = await this.props.acm.requestCertificate({
      domainName: domain,
      validationMethod: 'DNS',
      idempotencyToken,
      tags: [
        {
          Key: 'CreatedBy',
          Value: 'RouteCertProcess',
        },
      ],
    });

    this.props.ssmSrvc.put(this.props.certArnParameterName, certArn, {
      contentType: 'String',
      description: `ACM certificate ARN for ${domain}`,
    });

    // DomainValidationOptions may not be available immediately — retry a few times
    const validation = await this.getValidationRecordWithRetry(certArn);
    //let's check to see if that record already exists in the hosted zone before we try to create it
    const validationExists = await this.checkDomainExists(validation.name);
    if (validationExists) {
      throw new Error(
        `Validation record ${validation.name} already exists in Route53. Cannot proceed with certificate validation.`,
      );
    }

    const recordSet = Route53Service.buildSimpleRecordSet({
      name: validation.name,
      type: 'CNAME',
      ttl: 300,
      values: [validation.value],
    });

    // You still need to actually create the validation record in Route53
    // Prefer UPSERT so you can re-run safely.
    await this.props.route53.upsertRecord(
      hostedZoneId,
      recordSet,
      'ACM DNS validation',
    );

    // Now ACM can validate
    await this.props.acm.waitUntilIssued(certArn);
  }

  /**
   * Create a method that will check if a record set exists within hosted zone given a domain name
   */
  private async checkDomainExists(domain: string): Promise<boolean> {
    const zones = await this.props.route53.listHostedZones();
    for (const zone of zones) {
      const recordSets = await this.props.route53.listRecordSets(zone.Id!);
      if (recordSets.some((r) => r.Name === domain + '.')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retries until ACM exposes the DNS validation ResourceRecord.
   */
  private async getValidationRecordWithRetry(
    certificateArn: string,
    opts?: { attempts?: number; delayMs?: number },
  ): Promise<{ name: string; value: string }> {
    const attempts = opts?.attempts ?? 10;
    const delayMs = opts?.delayMs ?? 3000;

    let lastErr: unknown;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.props.acm.getDnsValidationRecord(certificateArn);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw new Error(
      `ACM validation record not available after ${attempts} attempts. Last error: ${String(lastErr)}`,
    );
  }
}
