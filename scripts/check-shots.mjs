// Says which shots are in order. Exits non zero unless everything it was asked about is in order.
//
//   node scripts/check-shots.mjs                 every shot and every count
//   node scripts/check-shots.mjs metal water     these whole groups
//   node scripts/check-shots.mjs home/hero       every required or defined shot whose name starts with this
//
// A shot is in order when all of these hold (kit/07-QUALITY-BAR.md, "The verdict ledger and the gate"):
//   it is one of the required names or is defined in scripts/shot-list.mjs, inside one of the groups
//   its image exists and the harness took it, or confirmed it unchanged, from the build of the sources on disk now
//     (the ref group is exempt: it comes from no build)
//   the newest verdict on exactly that image is a PASS, and:
//     metal, water and the piece groups: that PASS is a critic's, or it is yours and the ledger holds critic
//       verdicts on that shot from three different critic rounds
//     home and page, for the -desktop and -phone shots: the ledger holds at least one critic verdict on that shot
//     ref and tier: your own PASS is enough
//   a critic PASS counts only when the critic was given the reference image where one is required
// Critic verdicts count only when they come from an answer saved under kit/critics/.
import process from 'node:process';
import {
  CRITIC_GROUPS, CRITIC_ROUNDS, GROUPS, GROUP_COUNTS, NO_BUILD_GROUPS, PAGE_GROUPS, REFERENCES, REQUIRED,
  backedByAnswer, buildId, distIsStale, fileOf, groupOf, readLedger, readManifest, shaOfFile,
} from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const wanted = process.argv.slice(2);
const everything = wanted.length === 0;
const inScope = (name) => everything || wanted.some((q) => name.startsWith(q));
const problems = [];

// Names and counts.
const defined = Object.keys(SHOTS);
for (const name of REQUIRED.filter(inScope)) if (!(name in SHOTS)) problems.push(`${name}: required, and not defined in scripts/shot-list.mjs`);
for (const name of defined.filter(inScope)) if (!GROUPS.includes(groupOf(name))) problems.push(`${name}: ${groupOf(name)} is not a shot group`);
for (const [group, need] of Object.entries(GROUP_COUNTS)) {
  if (!everything && !wanted.some((q) => q === group || group.startsWith(q))) continue;
  const have = REQUIRED.filter((n) => groupOf(n) === group && n in SHOTS).length;
  if (have !== need) problems.push(`group ${group}: ${have} of ${need} required shots defined`);
}
for (const q of wanted) if (![...defined, ...REQUIRED].some((n) => n.startsWith(q))) problems.push(`${q}: no shot has this name or starts with it`);

// Verdicts.
const ledger = readLedger().filter((v) => v.who === 'builder' || backedByAnswer(v));
const stale = distIsStale();
const build = buildId();
const manifest = readManifest();
const scoped = defined.filter(inScope);
if (stale && scoped.some((n) => !NO_BUILD_GROUPS.includes(groupOf(n)))) problems.push('out/ is missing or was built from other sources than the ones on disk now. Run npm run build, then retake these shots');

function judge(name, sha) {
  const group = groupOf(name);
  const mine = ledger.filter((v) => v.shot === name);
  const current = mine.filter((v) => v.sha === sha);
  const last = current[current.length - 1];
  if (!last) return `no verdict on the current image (${sha})`;
  if (last.result !== 'PASS') return `the latest verdict on this image is FAIL (${sha}). Change the image`;
  const critics = mine.filter((v) => v.who === 'critic');
  if (CRITIC_GROUPS.includes(group)) {
    if (last.who === 'critic') {
      if (REFERENCES[name] && last.reference !== REFERENCES[name]) return `a critic passed it without its reference image ${REFERENCES[name]}. List it with scripts/critic-list.mjs --all and send it to a new critic`;
      return null;
    }
    const rounds = new Set(critics.map((v) => v.critic)).size;
    if (rounds < CRITIC_ROUNDS) return `your own PASS, and critic verdicts from ${rounds} of ${CRITIC_ROUNDS} rounds. Send the current image (${sha}) to a critic`;
    return null;
  }
  if (PAGE_GROUPS.includes(group) && /-(desktop|phone)$/.test(name) && critics.length === 0) return 'a page shot at desktop or phone needs one critic look on any image. Send it to a critic';
  return null;
}

let passed = 0;
for (const name of scoped) {
  const sha = shaOfFile(fileOf(name, SHOTS));
  if (!sha) { problems.push(`${name}: image missing`); continue; }
  const noBuild = NO_BUILD_GROUPS.includes(groupOf(name));
  if (!noBuild) {
    if (stale) continue;
    const noted = manifest[name];
    if (!noted || noted.sha !== sha || noted.build !== build) { problems.push(`${name}: not taken from the current build. Run npm run ${SHOTS[name].strip ? 'strips' : 'shots'} -- ${name}`); continue; }
  } else if (!manifest[name] || manifest[name].sha !== sha) { problems.push(`${name}: not taken by the harness. Run npm run shots -- ${name}`); continue; }
  const why = judge(name, sha);
  if (why) problems.push(`${name}: ${why}`); else passed++;
}

const total = everything ? REQUIRED.length : REQUIRED.filter(inScope).length;
console.log(`required in scope: ${total} · defined in scope: ${scoped.length} · passed: ${passed} · problems: ${problems.length}`);
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
