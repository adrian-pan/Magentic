const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '../..');

const EXECUTE_KEYWORDS = [
  'create', 'add', 'set', 'remove', 'delete', 'make', 'build', 'insert',
  'change', 'adjust', 'fix', 'put', 'place', 'record', 'mute', 'solo',
];

/**
 * Heuristic: does the user want REAPER actions executed?
 */
function wantsExecution(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return EXECUTE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Run the Python orchestrator with the given prompt.
 * Returns { plan, results, errors } or throws.
 */
function runOrchestrator(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [path.join(PROJECT_ROOT, 'run_agent.py')], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        BRIDGE_URL: process.env.BRIDGE_URL || 'http://localhost:5001',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('error', (err) => {
      reject(new Error(`Orchestrator spawn failed: ${err.message}`));
    });

    proc.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout);
        if (code !== 0) {
          reject(new Error(parsed.errors?.[0] || stderr || 'Orchestrator failed'));
        } else {
          resolve(parsed);
        }
      } catch (e) {
        reject(new Error(stderr || stdout || `Orchestrator exited ${code}`));
      }
    });

    proc.stdin.write(JSON.stringify({ prompt }));
    proc.stdin.end();
  });
}

module.exports = { wantsExecution, runOrchestrator };
