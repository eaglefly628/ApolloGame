#!/usr/bin/env node
import { runReleaseAction } from './lib/ios-release.mjs';
const [action, outputDir, ...args] = process.argv.slice(2);
const usage = 'Usage: node scripts/ios-release.mjs <doctor|simulator|sdk-build|archive|sign|export|device|upload|testflight-status|gate> <outputDir> [--execute] [--team-id TEAM] [--export-options FILE] [--device ID] [--target simulator|device|testflight] [--source-root DIR] [--allow-provisioning-updates]';
try {
  if (!action || !outputDir || !['doctor', 'simulator', 'sdk-build', 'archive', 'sign', 'export', 'device', 'upload', 'testflight-status', 'gate'].includes(action)) throw Error(usage);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === '--execute') options.execute = true;
    else if (name === '--allow-provisioning-updates') options.allowProvisioningUpdates = true;
    else if (['--team-id', '--export-options', '--device', '--target', '--source-root'].includes(name)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw Error(`Missing value for ${name}`);
      options[{ '--team-id': 'teamId', '--export-options': 'exportOptions', '--device': 'device', '--target': 'target', '--source-root': 'sourceRoot' }[name]] = value;
    } else throw Error(`Unknown argument: ${name}`);
  }
  const report = await runReleaseAction(action, outputDir, options);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'passed' ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
