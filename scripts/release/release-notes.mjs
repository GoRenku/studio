import { commandOutput, parseReleaseTag, repositoryRoot } from './release-contract.mjs';

const RELEASE_NOTES_INSTALL_URL =
  'https://gorenku.com/download/?utm_source=github&utm_medium=referral&utm_campaign=always-on&utm_content=release-notes';

const RELEASE_NOTES_SECTIONS = Object.freeze([
  { type: 'feat', title: 'Features' },
  { type: 'fix', title: 'Fixes' },
  { type: null, title: 'Other changes' },
]);

const CONVENTIONAL_SUBJECT = /^([a-z]+)(\([^)]*\))?!?:\s*(.*)$/i;

export function composeReleaseNotes({ tag, root = repositoryRoot }) {
  parseReleaseTag(tag);
  const previousTag = commandOutput(
    'git',
    ['describe', '--abbrev=0', '--match', 'v[0-9]*', `${tag}^`],
    { cwd: root }
  );
  const subjects = commandOutput(
    'git',
    ['log', '--no-merges', '--reverse', '--format=%s', `${previousTag}..${tag}`],
    { cwd: root }
  )
    .split('\n')
    .filter((subject) => subject && !/^release:/i.test(subject));

  const lines = [
    `Renku Studio beta · [Install](${RELEASE_NOTES_INSTALL_URL}) · Update an existing installation with \`renku update\``,
    '',
  ];
  for (const section of RELEASE_NOTES_SECTIONS) {
    const entries = subjects
      .map(classifySubject)
      .filter(({ type }) => sectionFor(type) === section)
      .map(({ text }) => `- ${text}`);
    if (entries.length > 0) {
      lines.push(`### ${section.title}`, ...entries, '');
    }
  }
  lines.push(
    `**Full changelog**: https://github.com/GoRenku/studio/compare/${previousTag}...${tag}`,
    ''
  );
  return lines.join('\n');
}

function classifySubject(subject) {
  const match = CONVENTIONAL_SUBJECT.exec(subject);
  const type = match ? match[1].toLowerCase() : null;
  const text = match ? match[3] : subject;
  return { type, text: text.charAt(0).toUpperCase() + text.slice(1) };
}

function sectionFor(type) {
  return (
    RELEASE_NOTES_SECTIONS.find((section) => section.type === type) ??
    RELEASE_NOTES_SECTIONS.find((section) => section.type === null)
  );
}
