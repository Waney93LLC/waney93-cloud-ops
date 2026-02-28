import { BootstrapContext, BootstrapStep } from "../types";

export class BootstrapRunner {
  constructor(private readonly steps: BootstrapStep[]) {}

  async run(ctx: BootstrapContext): Promise<void> {
    for (const step of this.steps) {
      ctx.log.info(`==> ${step.name}`);
      await step.run(ctx);
    }
  }
}