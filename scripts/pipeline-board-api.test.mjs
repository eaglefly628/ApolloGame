// Exercise the Python POST dispatcher in ordinary vitest runs, with no server or production signoff.
import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

it('pipeline API routes accept AI stages and require an explicit human signer', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', '-v', 'main_entry.test_pipeline_board'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30000,
  });
  expect(result.status, `${result.error || ''}\n${result.stdout || ''}\n${result.stderr || ''}`).toBe(0);
});
