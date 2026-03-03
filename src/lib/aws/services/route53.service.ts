import {
  Route53Client,
  ListHostedZonesCommand,
  ListHostedZonesCommandInput,
  ListResourceRecordSetsCommand,
  ListResourceRecordSetsCommandInput,
  ChangeResourceRecordSetsCommand,
  ChangeResourceRecordSetsCommandInput,
  GetChangeCommand,
  RRType,
  HostedZone,
  ResourceRecordSet,
} from '@aws-sdk/client-route-53';

/**
 * Route53Service
 *
 * Purpose:
 *   Thin service wrapper around AWS SDK v3 Route53Client.
 *
 * Notes:
 *   - Route 53 is a global service (region is typically "us-east-1").
 *   - All list methods handle pagination automatically.
 *   - For record mutations, Route 53 returns a ChangeInfo with an ID you can poll.
 *   - HostedZoneId is normalized (removes "/hostedzone/" if present).
 */
export class Route53Service {
  /**
   * Creates a new Route53Service.
   *
   * @param client - Preconfigured Route53Client (inject for tests).
   */
  constructor(private readonly client: Route53Client) {}

  /**
   * Retrieves all hosted zones in the account.
   *
   * @returns Promise<HostedZone[]>
   */
  public async listHostedZones(): Promise<HostedZone[]> {
    const zones: HostedZone[] = [];

    let marker: string | undefined = undefined;
    let isTruncated = true;

    while (isTruncated) {
      const input: ListHostedZonesCommandInput = { Marker: marker };

      const response = await this.client.send(
        new ListHostedZonesCommand(input),
      );

      if (response.HostedZones) zones.push(...response.HostedZones);

      isTruncated = response.IsTruncated ?? false;
      marker = response.NextMarker;
    }

    return zones;
  }

  /**
   * Retrieves all record sets for a specific hosted zone.
   *
   * @param hostedZoneId - The hosted zone ID (can include or exclude "/hostedzone/" prefix).
   * @returns Promise<ResourceRecordSet[]>
   */
  public async listRecordSets(
    hostedZoneId: string,
  ): Promise<ResourceRecordSet[]> {
    const records: ResourceRecordSet[] = [];
    const zoneId = this.normalizeHostedZoneId(hostedZoneId);

    let nextRecordName: string | undefined = undefined;
    let nextRecordType: string | undefined = undefined;
    let isTruncated = true;

    while (isTruncated) {
      const input: ListResourceRecordSetsCommandInput = {
        HostedZoneId: zoneId,
        StartRecordName: nextRecordName,
        StartRecordType: nextRecordType as any,
      };

      const response = await this.client.send(
        new ListResourceRecordSetsCommand(input),
      );

      if (response.ResourceRecordSets)
        records.push(...response.ResourceRecordSets);

      isTruncated = response.IsTruncated ?? false;
      nextRecordName = response.NextRecordName;
      nextRecordType = response.NextRecordType;
    }

    return records;
  }

  /**
   * Creates a record set (UPSERT semantics are often easier; use createRecord when you want strict create).
   *
   * @param hostedZoneId - Hosted zone ID.
   * @param recordSet - The ResourceRecordSet to create.
   * @param comment - Optional change comment.
   * @returns The Route 53 Change ID you can poll (e.g., "/change/C123...").
   */
  public async createRecord(
    hostedZoneId: string,
    recordSet: ResourceRecordSet,
    comment?: string,
  ): Promise<string> {
    // CREATE fails if the record already exists
    return this.changeRecord(hostedZoneId, 'CREATE', recordSet, comment);
  }

  /**
   * Upserts (creates or updates) a record set.
   *
   * @param hostedZoneId - Hosted zone ID.
   * @param recordSet - The ResourceRecordSet to upsert.
   * @param comment - Optional change comment.
   * @returns The Route 53 Change ID you can poll.
   */
  public async upsertRecord(
    hostedZoneId: string,
    recordSet: ResourceRecordSet,
    comment?: string,
  ): Promise<string> {
    return this.changeRecord(hostedZoneId, 'UPSERT', recordSet, comment);
  }

  /**
   * Deletes a record set.
   *
   * Important:
   *   Route 53 requires the delete request to match the existing record set values,
   *   including TTL and ResourceRecords (or AliasTarget).
   *
   * @param hostedZoneId - Hosted zone ID.
   * @param recordSet - The EXACT ResourceRecordSet to delete.
   * @param comment - Optional change comment.
   * @returns The Route 53 Change ID you can poll.
   */
  public async deleteRecord(
    hostedZoneId: string,
    recordSet: ResourceRecordSet,
    comment?: string,
  ): Promise<string> {
    return this.changeRecord(hostedZoneId, 'DELETE', recordSet, comment);
  }

  /**
   * Wait/poll Route 53 change until INSYNC (optional helper).
   *
   * @param changeId - Change ID returned by create/upsert/delete (may include "/change/").
   * @returns "INSYNC" or "PENDING"
   */
  public async getChangeStatus(
    changeId: string,
  ): Promise<'INSYNC' | 'PENDING'> {
    const normalized = changeId.startsWith('/change/')
      ? changeId
      : `/change/${changeId}`;

    const res = await this.client.send(
      new GetChangeCommand({ Id: normalized }),
    );
    const status = res.ChangeInfo?.Status;

    // Route53 returns "PENDING" or "INSYNC"
    return status === 'INSYNC' ? 'INSYNC' : 'PENDING';
  }

  /**
   * Convenience helper to build a simple non-alias record set.
   *
   * @param name - Fully qualified record name (e.g., "auth.waney93.com.")
   * @param type - Record type (e.g., "A", "CNAME", "TXT")
   * @param ttl - TTL in seconds
   * @param values - Record values (e.g., ["1.2.3.4"] or ["d123.cloudfront.net."])
   */
  public static buildSimpleRecordSet(params: {
    name: string;
    type: RRType | string;
    ttl: number;
    values: string[];
  }): ResourceRecordSet {
    const { name, type, ttl, values } = params;

    return {
      Name: name,
      Type: type as RRType,
      TTL: ttl,
      ResourceRecords: values.map((v) => ({ Value: v })),
    };
  }

  public static buildAliasAaaaRecordSet(params: {
    name: string;
    aliasHostedZoneId: string;
    aliasDnsName: string;
    evaluateTargetHealth?: boolean;
  }): ResourceRecordSet {
    const {
      name,
      aliasHostedZoneId,
      aliasDnsName,
      evaluateTargetHealth = false,
    } = params;

    return {
      Name: name,
      Type: 'AAAA' as RRType,
      AliasTarget: {
        HostedZoneId: aliasHostedZoneId,
        DNSName: aliasDnsName,
        EvaluateTargetHealth: evaluateTargetHealth,
      },
    };
  }

  public static buildAliasARecordSet(params: {
    name: string;
    aliasHostedZoneId: string; // ALB hosted zone id (Z35SXDOTRQ7X7K)
    aliasDnsName: string; // ALB DNS name (must end with .)
    evaluateTargetHealth?: boolean;
  }): ResourceRecordSet {
    const {
      name,
      aliasHostedZoneId,
      aliasDnsName,
      evaluateTargetHealth = false,
    } = params;

    return {
      Name: name,
      Type: 'A' as RRType,
      AliasTarget: {
        HostedZoneId: aliasHostedZoneId,
        DNSName: aliasDnsName,
        EvaluateTargetHealth: evaluateTargetHealth,
      },
    };
  }

  /**
   * Normalizes Hosted Zone IDs returned by AWS (often "/hostedzone/Z123...").
   */
  private normalizeHostedZoneId(hostedZoneId: string): string {
    return hostedZoneId.replace('/hostedzone/', '');
  }

  /**
   * Internal helper to apply a Route 53 change (CREATE, UPSERT, DELETE).
   */
  private async changeRecord(
    hostedZoneId: string,
    action: 'CREATE' | 'UPSERT' | 'DELETE',
    recordSet: ResourceRecordSet,
    comment?: string,
  ): Promise<string> {
    const zoneId = this.normalizeHostedZoneId(hostedZoneId);

    const input: ChangeResourceRecordSetsCommandInput = {
      HostedZoneId: zoneId,
      ChangeBatch: {
        Comment: comment,
        Changes: [
          {
            Action: action,
            ResourceRecordSet: recordSet,
          },
        ],
      },
    };

    const res = await this.client.send(
      new ChangeResourceRecordSetsCommand(input),
    );
    const changeId = res.ChangeInfo?.Id;

    if (!changeId) {
      throw new Error(
        `Route53 change did not return a ChangeInfo.Id (action=${action}, zone=${zoneId}).`,
      );
    }

    return changeId; // typically "/change/C..."
  }
}
