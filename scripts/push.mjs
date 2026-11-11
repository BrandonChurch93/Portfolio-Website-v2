// Pushes main to origin without ever waiting for a person. Run it with no arguments: node scripts/push.mjs
// A plain git push can open a login prompt or a browser window and hang forever when no credentials are stored.
// This turns every prompt off and gives up after 100 seconds, inside the time a command is allowed to run.
// Exit codes: 0 pushed, 1 not pushed (the reason is printed; log it and carry on, it is never a blocker).
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const run = (args, timeout) => spawnSync('git', args, {
  encoding: 'utf8',
  timeout,
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new',
  },
});

const remote = run(['remote', 'get-url', 'origin'], 15000);
if (remote.status !== 0) {
  console.log('NOT PUSHED: there is no remote named origin. REPO_URL was NONE or was never added.');
  process.exit(1);
}
const branch = run(['rev-parse', '--abbrev-ref', 'HEAD'], 15000);
if ((branch.stdout || '').trim() !== 'main') {
  console.log(`NOT PUSHED: the current branch is "${(branch.stdout || '').trim()}", not main.`);
  process.exit(1);
}
const push = run(['-c', 'credential.interactive=false', 'push', 'origin', 'main'], 100000);
const out = `${push.stdout || ''}${push.stderr || ''}`.trim();
if (push.status === 0) {
  console.log(`PUSHED main to ${remote.stdout.trim()}`);
  if (out) console.log(out);
  process.exit(0);
}
console.log(`NOT PUSHED to ${remote.stdout.trim()}`);
console.log(push.error ? `git did not finish: ${push.error.message}` : out || `git exited with ${push.status}`);
process.exit(1);
