#!/usr/bin/env node
// Compatibility entry point: defaults, phase names and real output protocol are retained.
import { designMeasureCLI } from './design-measure.mjs';
designMeasureCLI(process.argv.slice(2), 'game108').catch(error => {
  console.error(`[design-measure] 拒收: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
});
