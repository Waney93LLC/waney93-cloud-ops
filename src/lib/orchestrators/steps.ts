import { BootstrapContext, BootstrapStep, KeyValueStore } from "../types";

export class EnsureCodestarArnStep implements BootstrapStep {
  name = 'Ensure CodeStar connection ARN is stored';

  constructor(
    private readonly kv: KeyValueStore,
    private readonly key: string,
    private readonly envVarName: string,
  ) {}

  async run(ctx: BootstrapContext): Promise<void> {
    const arn = ctx.env[this.envVarName];
    if (!arn) {
      ctx.log.warn(`${this.envVarName} not set; skipping.`);
      return;
    }

    await this.kv.put(this.key, arn, {
      contentType: 'String',
      description: 'CodeStar connection ARN',
    });
    ctx.log.info(`Stored ${this.envVarName} at ${this.key}`);
  }
}