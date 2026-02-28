import { AwsCiCdBootstrapProcess } from './lib/aws/processes/bootstrap.process';
import { PlatformConfigOrchestrator } from './lib/orchestrators/platform-config.orch';

const orchestrator = new PlatformConfigOrchestrator({
  cloud: 'aws',
  awsBootstrap: new AwsCiCdBootstrapProcess(),
});

orchestrator.initialize().catch((error) => {
  console.error('Error initializing platform configuration:', error);
  process.exit(1);
});
