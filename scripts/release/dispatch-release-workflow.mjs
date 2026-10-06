#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import {
  assertCleanTree,
  assertMainBranch,
  assertOriginMainIsAncestor,
  assertReleaseTagAtHead,
  fetchOriginMain,
  requireCommand,
  runCommand,
} from './release-contract.mjs';

export async function dispatchAndWaitForRelease(tag, {
  dryRun = false,
  command = runCommand,
  timeoutMs = 90 * 60 * 1000,
  pollMs = 15_000,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) {
  const commit = command('git', ['rev-parse', `${tag}^{commit}`], { stdio: 'pipe' }).stdout.trim();
  if (dryRun) {
    process.stdout.write(`Release ${tag} requires native populated upgrades on Windows and both Macs, matching archive checksums, and a successful release.yml publication. No native verification or remote mutation occurred.\n`);
    return;
  }
  command('git', ['push', 'origin', 'main']);
  command('git', ['push', 'origin', tag]);
  const runs = () => JSON.parse(command('gh', ['run', 'list', '--workflow', 'release.yml', '--branch', tag,
    '--commit', commit, '--event', 'workflow_dispatch', '--limit', '20',
    '--json', 'databaseId,status,conclusion,headSha,url'], { stdio: 'pipe' }).stdout);
  let run = runs().find((entry) => entry.headSha === commit);
  let minimumAttempt = 0;
  if (run?.status === 'completed' && run.conclusion !== 'success') {
    const previous = JSON.parse(command('gh', ['run', 'view', String(run.databaseId),
      '--json', 'attempt'], { stdio: 'pipe' }).stdout);
    minimumAttempt = previous.attempt + 1;
    command('gh', ['run', 'rerun', String(run.databaseId), '--failed']);
  }
  if (!run) {
    command('gh', ['workflow', 'run', 'release.yml', '--ref', tag, '-f', `tag=${tag}`]);
  }
  const deadline = now() + timeoutMs;
  let lastStatus;
  while (now() < deadline) {
    if (run) {
      const status = JSON.parse(command('gh', ['run', 'view', String(run.databaseId),
        '--json', 'databaseId,status,conclusion,headSha,url,attempt'], { stdio: 'pipe' }).stdout);
      if (status.headSha !== commit) { throw new Error('RELEASE077 Release workflow does not match the immutable tag.'); }
      if (status.status !== lastStatus) {
        process.stdout.write(`Native release ${tag}: ${status.status} (${status.url}).\n`);
        lastStatus = status.status;
      }
      if (status.status === 'completed' && (!minimumAttempt || status.attempt >= minimumAttempt)) {
        if (status.conclusion !== 'success') {
          throw new Error(`RELEASE020 Native release workflow ${status.conclusion}: ${status.url}`);
        }
        const release = JSON.parse(command('gh', ['release', 'view', tag, '--json', 'url,isDraft,tagName'], { stdio: 'pipe' }).stdout);
        if (release.isDraft || release.tagName !== tag) { throw new Error('RELEASE077 Workflow completed without publishing the requested release.'); }
        process.stdout.write(`Published Studio ${tag}: ${release.url}\n`);
        return release;
      }
    }
    await delay(pollMs);
    if (!run) { run = runs().find((entry) => entry.headSha === commit); }
  }
  throw new Error(`RELEASE020 Timed out waiting for native release evidence for ${tag}${run ? `: ${run.url}` : ''}. Retry the same tag to resume.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const index = args.indexOf('--tag');
    const tag = index >= 0 ? args[index + 1] : undefined;
    if (!tag) { throw new Error('RELEASE093 Usage: dispatch-release-workflow.mjs --tag vX.Y.Z [--dry-run]'); }
    for (const command of ['git', 'gh']) { requireCommand(command); }
    assertMainBranch();
    assertCleanTree();
    fetchOriginMain();
    assertOriginMainIsAncestor();
    assertReleaseTagAtHead(tag);
    await dispatchAndWaitForRelease(tag, { dryRun: args.includes('--dry-run') });
  } catch (error) {
    process.stderr.write(`[release:dispatch] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
