import assert from 'node:assert/strict';
import test from 'node:test';
import { launchAgentPlist } from './launch-agent-plist.mjs';

const plist = launchAgentPlist({
  label: 'com.gorenku.growth-report',
  nodePath: '/opt/node & co/bin/node',
  repositoryRoot: '/Users/maintainer/Projects <studio>',
  logPath: '/Users/maintainer/Library/Logs/renku-growth-report.log',
  hour: 9,
  minute: 17,
});

test('runs the report with the repository .env and failure notifications', () => {
  assert.match(plist, /<key>Label<\/key>\n {2}<string>com\.gorenku\.growth-report<\/string>/);
  assert.match(plist, /<string>\/opt\/node &amp; co\/bin\/node<\/string>/);
  assert.match(plist, /<string>--env-file=\/Users\/maintainer\/Projects &lt;studio&gt;\/\.env<\/string>/);
  assert.match(plist, /<string>\/Users\/maintainer\/Projects &lt;studio&gt;\/scripts\/growth-report\/report-growth\.mjs<\/string>/);
  assert.match(plist, /<string>--notify-on-failure<\/string>/);
  assert.match(plist, /<key>WorkingDirectory<\/key>\n {2}<string>\/Users\/maintainer\/Projects &lt;studio&gt;<\/string>/);
});

test('runs daily at the given local time and logs both streams', () => {
  assert.match(plist, /<key>Hour<\/key>\n {4}<integer>9<\/integer>/);
  assert.match(plist, /<key>Minute<\/key>\n {4}<integer>17<\/integer>/);
  assert.equal(plist.match(/renku-growth-report\.log/g).length, 2);
});
