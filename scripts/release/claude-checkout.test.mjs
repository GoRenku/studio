import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { prepareClaudeMarketplaceCheckout } from '../../distribution/claude/checkout.mjs';
import { claudeMarketplaceFixture } from './fixtures/claude-marketplace.mjs';

test('checkout clones and fast-forwards the remote default branch across plugin versions', () => {
  const fixture = claudeMarketplaceFixture();
  const options = { repository: fixture.repository };
  assert.equal(prepareClaudeMarketplaceCheckout(fixture.checkout, options).version, '0.1.0');
  fixture.release('0.2.0', 'updated-command');
  assert.equal(prepareClaudeMarketplaceCheckout(fixture.checkout, options).version, '0.2.0');
  assert.match(readFileSync(path.join(fixture.checkout, 'skills/updated-command/SKILL.md'), 'utf8'), /0.2.0/);
  assert.equal(prepareClaudeMarketplaceCheckout(fixture.checkout, options).version, '0.2.0');
});

test('existing non-checkout files are preserved', () => {
  const { checkout, repository } = claudeMarketplaceFixture();
  mkdirSync(checkout, { recursive: true });
  writeFileSync(path.join(checkout, 'notes.txt'), 'Keep this');
  assert.throws(() => prepareClaudeMarketplaceCheckout(checkout, { repository }), /not a Git checkout/);
  assert.equal(readFileSync(path.join(checkout, 'notes.txt'), 'utf8'), 'Keep this');
});

for (const state of ['dirty', 'different origin', 'local commit']) {
  test(`checkout preserves ${state} rather than overwriting it`, () => {
    const { checkout, repository, git } = claudeMarketplaceFixture();
    prepareClaudeMarketplaceCheckout(checkout, { repository });
    if (state === 'different origin') git(['remote', 'set-url', 'origin', 'https://example.invalid/other.git'], checkout);
    else {
      writeFileSync(path.join(checkout, 'notes.txt'), 'Keep this');
      if (state === 'local commit') {
        git(['add', 'notes.txt'], checkout);
        git(['-c', 'user.name=Renku Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Local work'], checkout);
      }
    }
    const before = git(['rev-parse', 'HEAD'], checkout);
    assert.throws(() => prepareClaudeMarketplaceCheckout(checkout, { repository }));
    assert.equal(git(['rev-parse', 'HEAD'], checkout), before);
    if (state !== 'different origin') assert.equal(readFileSync(path.join(checkout, 'notes.txt'), 'utf8'), 'Keep this');
  });
}
