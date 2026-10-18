const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function xmlText(value) {
  return String(value).replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}

/** The launchd agent that runs the growth report once a day. */
export function launchAgentPlist({ label, nodePath, repositoryRoot, logPath, hour, minute }) {
  const programArguments = [
    nodePath,
    `--env-file=${repositoryRoot}/.env`,
    `${repositoryRoot}/scripts/growth-report/report-growth.mjs`,
    '--notify-on-failure',
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlText(label)}</string>
  <key>ProgramArguments</key>
  <array>
${programArguments.map((argument) => `    <string>${xmlText(argument)}</string>`).join('\n')}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlText(repositoryRoot)}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlText(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlText(logPath)}</string>
</dict>
</plist>
`;
}
