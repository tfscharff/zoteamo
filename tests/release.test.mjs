import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHeader,
  bumpFor,
  nextVersion,
  changelogEntry,
  insertChangelog,
} from '../scripts/lib/release.mjs';

test('parseHeader reads type, scope, breaking flag and description', () => {
  assert.deepEqual(parseHeader('feat(items): add voting'), {
    type: 'feat', scope: 'items', breaking: false, description: 'add voting',
  });
  assert.deepEqual(parseHeader('fix!: drop old export route'), {
    type: 'fix', scope: null, breaking: true, description: 'drop old export route',
  });
});

test('parseHeader rejects headers that are not conventional commits', () => {
  assert.throws(() => parseHeader('Added voting'), /Conventional Commit/);
  assert.throws(() => parseHeader('feature: add voting'), /Conventional Commit/);
  assert.throws(() => parseHeader('feat: '), /Conventional Commit/);
});

test('bumpFor maps commit types to SemVer bumps', () => {
  assert.equal(bumpFor(parseHeader('feat: x')), 'minor');
  assert.equal(bumpFor(parseHeader('fix: x')), 'patch');
  assert.equal(bumpFor(parseHeader('docs: x')), 'patch');
  assert.equal(bumpFor(parseHeader('chore: x')), 'patch');
  assert.equal(bumpFor(parseHeader('feat!: x')), 'major');
  assert.equal(bumpFor(parseHeader('fix: x'), 'BREAKING CHANGE: removed y'), 'major');
});

test('nextVersion applies bumps, treating breaking changes as minor before 1.0.0', () => {
  assert.equal(nextVersion('0.1.0', 'patch'), '0.1.1');
  assert.equal(nextVersion('0.1.3', 'minor'), '0.2.0');
  assert.equal(nextVersion('0.4.2', 'major'), '0.5.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.throws(() => nextVersion('1.2', 'patch'), /version/);
});

test('changelogEntry formats a dated entry with the commit description', () => {
  assert.equal(
    changelogEntry('0.2.0', '2026-10-06', parseHeader('feat(items): add voting')),
    '## [0.2.0] - 2026-10-06\n\n- **feat(items):** add voting\n',
  );
});

test('insertChangelog puts the newest entry directly under the intro', () => {
  const before = '# Changelog\n\nIntro text.\n\n## [0.1.0] - 2026-10-01\n\n- **chore:** start\n';
  const entry = '## [0.1.1] - 2026-10-02\n\n- **fix:** typo\n';
  assert.equal(
    insertChangelog(before, entry),
    '# Changelog\n\nIntro text.\n\n## [0.1.1] - 2026-10-02\n\n- **fix:** typo\n\n## [0.1.0] - 2026-10-01\n\n- **chore:** start\n',
  );
  assert.equal(
    insertChangelog('# Changelog\n\nIntro text.\n', entry),
    '# Changelog\n\nIntro text.\n\n## [0.1.1] - 2026-10-02\n\n- **fix:** typo\n',
  );
});
