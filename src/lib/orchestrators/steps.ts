import { BootstrapContext, BootstrapStep, KeyValueStore } from "../types";

export class EnsureCodestarArnStep implements BootstrapStep {
  name = 'Ensure CodeStar connection ARN is stored';

  constructor(
    private readonly kv: KeyValueStore,
    private readonly key: string,
  ) {}

  async run(ctx: BootstrapContext): Promise<void> {
    const arn = ctx.env.CODESTARE_CONNECTION_ARN;
    if (!arn) {
      ctx.log.warn(`CODESTARE_CONNECTION_ARN not set; skipping.`);
      return;
    }

    await this.kv.put(this.key, arn, {
      contentType: 'String',
      description: 'CodeStar connection ARN',
    });
    ctx.log.info(`Stored CODESTARE_CONNECTION_ARN at ${this.key}`);
  }
}