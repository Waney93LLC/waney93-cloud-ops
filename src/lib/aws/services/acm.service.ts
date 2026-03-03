import {
  ACMClient,
  ListCertificatesCommand,
  ListCertificatesCommandInput,
  ListCertificatesCommandOutput,
  CertificateSummary,
  DescribeCertificateCommand,
  DescribeCertificateCommandOutput,
  RequestCertificateCommand,
  RequestCertificateCommandInput,
  RequestCertificateCommandOutput,
  DeleteCertificateCommand,
  DeleteCertificateCommandInput,
  CertificateStatus,
  DomainValidation,
} from '@aws-sdk/client-acm';

/**
 * AcmService
 *
 * Purpose:
 *   Thin service wrapper around AWS SDK v3 ACMClient to manage ACM certificates.
 *
 * Notes:
 *   - ACM is regional. You must create/list/delete in the intended region.
 *   - For CloudFront (and Cognito custom domains), certificates must be in us-east-1.
 *   - RequestCertificate returns an ARN; DNS validation records are obtained via DescribeCertificate.
 */
export class AcmService {
  /**
   * Creates a new AcmService.
   *
   * @param client - Preconfigured ACMClient (inject for tests).
   */
  constructor(private readonly client: ACMClient) {}

  /**
   * Lists ACM certificates in the client region.
   *
   * @param options - Optional filters and page size.
   * @returns Promise<CertificateSummary[]>
   */
  public async listCertificates(options?: {
    statuses?: CertificateStatus[];
    includes?: ListCertificatesCommandInput['Includes'];
    pageSize?: number;
  }): Promise<CertificateSummary[]> {
    const certs: CertificateSummary[] = [];

    let nextToken: string | undefined = undefined;

    do {
      const input: ListCertificatesCommandInput = {
        NextToken: nextToken,
        CertificateStatuses: options?.statuses,
        Includes: options?.includes,
        MaxItems: options?.pageSize,
      };

      const res: ListCertificatesCommandOutput = await this.client.send(
        new ListCertificatesCommand(input),
      );

      if (res.CertificateSummaryList) certs.push(...res.CertificateSummaryList);
      nextToken = res.NextToken;
    } while (nextToken);

    return certs;
  }

  /**
   * Requests a new ACM certificate.
   *
   * Typical use:
   *   - ValidationMethod: 'DNS'
   *   - Then call describeCertificate() to fetch DomainValidationOptions
   *     and create the needed DNS records in Route 53.
   *
   * @param params - Request parameters.
   * @returns The new certificate ARN.
   */
  public async requestCertificate(params: {
    domainName: string;
    subjectAlternativeNames?: string[];
    validationMethod?: 'DNS' | 'EMAIL';
    idempotencyToken?: string;
    tags?: RequestCertificateCommandInput['Tags'];
    options?: RequestCertificateCommandInput['Options'];
  }): Promise<string> {
    const input: RequestCertificateCommandInput = {
      DomainName: params.domainName,
      SubjectAlternativeNames: params.subjectAlternativeNames,
      ValidationMethod: params.validationMethod ?? 'DNS',
      IdempotencyToken: params.idempotencyToken,
      Tags: params.tags,
      Options: params.options,
    };

    const res: RequestCertificateCommandOutput = await this.client.send(
      new RequestCertificateCommand(input),
    );

    const arn = res.CertificateArn;
    if (!arn) {
      throw new Error(
        `ACM RequestCertificate did not return CertificateArn (domain=${params.domainName}).`,
      );
    }

    return arn;
  }

  /**
   * Describes an ACM certificate by ARN.
   *
   * @param certificateArn - Certificate ARN.
   * @returns Full DescribeCertificate output.
   */
  public async describeCertificate(
    certificateArn: string,
  ): Promise<DescribeCertificateCommandOutput> {
    const res: DescribeCertificateCommandOutput = await this.client.send(
      new DescribeCertificateCommand({ CertificateArn: certificateArn }),
    );

    return res;
  }

  /**
   * Returns DNS validation records (CNAMEs) for a certificate, if available.
   *
   * Useful after requestCertificate() when ValidationMethod = DNS.
   *
   * @param certificateArn - Certificate ARN.
   * @returns DomainValidation[] (may be empty if not ready yet)
   */
  public async getDnsValidationOptions(
    certificateArn: string,
  ): Promise<DomainValidation[]> {
    const res = await this.describeCertificate(certificateArn);
    return res.Certificate?.DomainValidationOptions ?? [];
  }

  /**
   * Deletes an ACM certificate by ARN.
   *
   * Important:
   *   ACM will refuse deletion if the certificate is in use (e.g., attached to ALB/CloudFront).
   *
   * @param certificateArn - Certificate ARN.
   */
  public async deleteCertificate(certificateArn: string): Promise<void> {
    const input: DeleteCertificateCommandInput = {
      CertificateArn: certificateArn,
    };

    await this.client.send(new DeleteCertificateCommand(input));
  }

  public async waitUntilIssued(
    certificateArn: string,
    opts?: { timeoutMs?: number; pollMs?: number },
  ): Promise<void> {
    const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000; // 10 min
    const pollMs = opts?.pollMs ?? 10_000; // 10s
    const start = Date.now();

    while (true) {
      const res = await this.describeCertificate(certificateArn);
      const status = res.Certificate?.Status as CertificateStatus | undefined;

      if (status === 'ISSUED') return;

      if (status === 'FAILED') {
        const reason = res.Certificate?.FailureReason ?? 'UNKNOWN';
        throw new Error(`ACM certificate FAILED: ${reason}`);
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for ACM certificate to be ISSUED.`);
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  public async getDnsValidationRecord(certificateArn: string): Promise<{
    name: string;
    value: string;
  }> {
    const res = await this.describeCertificate(certificateArn);

    const rr = res.Certificate?.DomainValidationOptions?.[0]?.ResourceRecord;
    if (!rr?.Name || !rr?.Value) {
      throw new Error(
        `ACM validation record not available yet. Try again in a few seconds.`,
      );
    }

    return { name: rr.Name, value: rr.Value };
  }
}
