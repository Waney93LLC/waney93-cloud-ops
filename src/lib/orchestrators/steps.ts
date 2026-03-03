import { BootstrapContext, BootstrapStep, EnsureConfigValueStepProps, KeyValueStore } from "../types";

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
      description: this.props.description || `Stored by EnsureConfigValueStep for ${this.props.envVar}`,
    });
    ctx.log.info(`Stored ${this.props.envVar} at ${this.props.key}`);
  }
}