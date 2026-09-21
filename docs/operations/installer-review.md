# Installer lifecycle review

Reviewed September 21, 2026. This is an engineering review and verification
record, not a claim of native Windows certification.

## Scope and ownership

Reviewed both bootstrap installers, runtime packaging and verification, core's
update orchestration, the bundled skills invocation, website instructions, and
uninstall documentation. Platform installation behavior stays in `distribution`;
core continues to own update commands. No dependency, background service, GUI,
new CLI command, or replacement skills installer was introduced.

The Windows launcher now uses `renku.cmd` plus `renku-launch.ps1`. Installation
removes the conflicting same-name `renku.ps1` launcher. Execution policy is set
only for the launcher's child process; no user or machine policy is changed.
Minimum OS checks now enforce macOS 13.5 and Windows x64 with the built-in
archive tool (Windows 10 1803+). Apple silicon running a translated terminal
selects the arm64 runtime. These are material installer behavior changes.

## Findings and fixes

| Finding | Consequence | Change |
| --- | --- | --- |
| Current-shell PATH was not refreshed | First launch failed after installation | Windows updates process PATH; the Mac website command updates its parent shell after successful setup. Full-path launch commands are also available. |
| Shell interpolation in generated Mac paths | Apostrophes, dollars, or backticks could break launch or evaluate text | Literal single-quote escaping for launcher paths, printed commands, and the managed PATH block. |
| Mac PATH marker was never refreshed | Changing the launcher folder left future terminals using the previous location | Replace only the managed block; preserve surrounding user configuration. |
| Windows batch launcher embedded ASCII-only absolute paths | Non-ASCII account/folder names were corrupted | ASCII relative batch entrypoint invokes a BOM-marked Unicode PowerShell launcher. |
| Same-name PowerShell script participated in command discovery | Restrictive script execution settings could block `renku` | One public `.cmd` command invokes the internal script with a process-only policy. Enterprise Group Policy remains authoritative. |
| Pasted Windows installer leaked shell preferences and variables | Strict mode and error handling changed the user's shell | Installer runs inside a child script scope; only intended environment changes persist. |
| Windows ZIP has internal paths up to 264 characters | Traditional archive extraction can fail before the install-root prefix is added | Use the built-in native archive tool; check it before downloading. Native long-path verification remains required. |
| Download/extraction gave poor feedback and no bounded retry | Slow or interrupted installs looked stuck or failed immediately | Stage messages, bounded network retries, and an explicit extraction failure. Suppress the Windows progress overlay. |
| System temporary directory could be on another volume | Activation could become a cross-volume copy | Stage under the chosen install root so final activation is a same-volume move. |
| Extracted target and skills executable were not checked | A mismatched or incomplete product could activate | Check target and execute the bundled skills version command before activation. |
| Skills cancellation returns exit code zero | Installer could claim skills had updated after “No” | Conditional completion language, retry guidance, and launch instructions before the skills step. |
| Mac pipeline could mask a failed bootstrap download | `sh` could exit zero after receiving no script | Website command enables pipeline failure detection in a subshell. |
| Release server check accepted any listener on port 5173 | An unrelated existing Studio could yield a false pass | Verify the spawned process's PID through the status contract and require that process to remain alive. |
| Release verification inherited Windows/XDG configuration paths | Test initialization could touch real user configuration | Isolate HOME, USERPROFILE, LOCALAPPDATA, and XDG_CONFIG_HOME. |

Previous fixes retained: immutable versioned downloads paired with their manifest
checksum; retry without downloading a healthy installed version; pinned bundled
skills tooling under repository dependency checks; hoisted Windows dependencies;
skills-only updates; preservation of movie libraries and settings during updates.

## Verification

- macOS installer integration fixtures cover fresh installation, the current
  parent shell, Unicode/shell-special paths, custom locations, managed-profile
  replacement, translated Apple silicon detection, unsupported OS rejection,
  missing Git, no interactive terminal, skills failure/cancellation retries,
  full and skills-only updates, malformed manifests, checksum failure, failed
  downloads, damaged installations, and invalid extracted runtimes.
- Core update tests cover scope, custom installation metadata, running-Studio
  rejection, subprocess failure, and Windows argument construction.
- Release verifier regression rejects a no-op server and confirms configuration
  isolation. Packaging tests check extracted dependency resolution and links.
- Website type checks/build and desktop platform-tab inspection verify the
  visible launch commands and their copy-button payloads.

These fixtures do not simulate Windows PowerShell, antivirus, Group Policy,
real Windows filesystem locks, or the third-party skills prompt implementation.

## Native Windows release gate

Run on a clean ordinary-user Windows account without Node or Git:

1. Install from the published command in Windows PowerShell 5.1; confirm the
   complete archive extracts, private Git works, and agent selection appears.
2. Decline skills confirmation. Run the same installer again and confirm no
   runtime download/extraction occurs. Complete agent selection this time.
3. Run `renku about` and `renku studio start` in the same terminal and a fresh
   terminal. Confirm Studio opens and Ctrl+C stops it. Check exit-code forwarding.
4. Repeat under an account/custom location containing spaces, accented letters,
   apostrophes, brackets, and an exclamation mark. Check quoted CLI arguments.
5. Verify the launcher under the normal restricted execution policy, and verify
   the installer leaves the caller's preferences and strict mode unchanged.
6. Interrupt a download and retry; simulate an extraction failure; verify a
   previous installation remains usable. Check cleanup and disk use.
7. Run both update scopes, including an already-current runtime and a new version.
   Confirm full update refuses while Studio is running and skills-only does not.
8. Verify PowerShell 7 and a 32-bit PowerShell process on x64 Windows if these
   invocation environments are used. Confirm unsupported ARM64 is rejected.
9. Follow the uninstall guide; preserve the film library and optional settings.

## Remaining boundaries

- Native Windows verification is still required before claiming the Windows
  experience is verified. macOS automated fixtures cannot replace it.
- Installation is not a fully journaled transaction across runtime, launchers,
  PATH, and skills. Concurrent installers and forced termination during final
  activation need dedicated testing; normal retries repair incomplete setup,
  but a power-loss recovery guarantee has not been established.
- A hard-killed installer may leave its private staging folder. Downloads do
  not resume across separate runs; healthy installed runtimes are reused.
- Skills are fetched from the skills repository's current default branch.
  Third-party security scans and their refresh latency remain external.
- Removing a skill from the source repo does not guarantee deletion of copies
  already installed in agent folders. Automated deletion needs an ownership
  policy to avoid deleting a user's independently maintained skill.
- Older runtime versions remain available after updates; automatic disk-space
  cleanup and a GUI installer remain separate product work.
- Existing Studio detection and occupied-port/browser-open diagnostics already
  exist in core/CLI. The installer does not silently kill another process.

## Sources

- [Node 24.16 platform requirements](https://github.com/nodejs/node/blob/v24.16.0/BUILDING.md)
- [Microsoft: Windows tar](https://learn.microsoft.com/en-us/windows/tar/)
- [Microsoft: execution policies](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
- [Microsoft: character encoding](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding)
