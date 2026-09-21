# Keep installer variables and shell preferences out of the caller's session.
& {
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$BaseUrl = if ($env:RENKU_DOWNLOAD_BASE_URL) { $env:RENKU_DOWNLOAD_BASE_URL } else { 'https://downloads.gorenku.com' }
$InstallRoot = if ($env:RENKU_INSTALL_ROOT) { $env:RENKU_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA 'Renku' }
$BinRoot = if ($env:RENKU_BIN_ROOT) { $env:RENKU_BIN_ROOT } else { Join-Path $InstallRoot 'bin' }

function Save-RenkuDownload([string]$Url, [string]$DestinationFile) {
  for ($Attempt = 1; $Attempt -le 3; $Attempt++) {
    try {
      Invoke-WebRequest -UseBasicParsing -TimeoutSec 1800 -Uri $Url -OutFile $DestinationFile
      return
    } catch {
      if ($Attempt -eq 3) { throw "INSTALL002 Could not download $Url. Check your connection and rerun the installer. $($_.Exception.Message)" }
      Start-Sleep -Seconds 2
    }
  }
}

function Expand-RenkuArchive([string]$ArchiveFile, [string]$DestinationFolder) {
  New-Item -ItemType Directory -Force -Path $DestinationFolder | Out-Null
  & $TarCommand -xf $ArchiveFile -C $DestinationFolder
  if ($LASTEXITCODE -ne 0) { throw 'INSTALL004 Could not extract the archive. Check free disk space and folder permissions, then rerun the installer.' }
}

function Test-GitCommand([string]$Command) {
  try {
    & $Command --version 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Test-InstalledRuntime([string]$Product, [string]$Version) {
  try {
    $InstalledRelease = Get-Content -LiteralPath (Join-Path $Product 'RELEASE.json') -Raw | ConvertFrom-Json
    if ($InstalledRelease.version -cne $Version -or $InstalledRelease.target -cne $Target) { return $false }
    $InstalledNode = Join-Path $Product 'runtime\node\node.exe'
    $InstalledSkills = Join-Path $Product 'app\node_modules\skills\bin\cli.mjs'
    if (-not (Test-Path -LiteralPath $InstalledSkills)) { return $false }
    & $InstalledNode (Join-Path $Product 'app\dist\cli.js') about 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return $false }
    & $InstalledNode $InstalledSkills --version 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Install-AgentSkills {
  $SkillsEntry = Join-Path $Destination 'app\node_modules\skills\bin\cli.mjs'
  if (-not (Test-Path -LiteralPath $SkillsEntry)) { throw 'INSTALL006 Bundled skills installer is missing. Reinstall Renku to restore it.' }
  if ([Console]::IsInputRedirected) { throw 'INSTALL007 Run this installer in an interactive PowerShell window to choose your agents.' }

  $PreviousPath = $env:PATH
  try {
    $env:PATH = "$(Split-Path $NodeCommand);$env:PATH"
    if (-not (Test-GitCommand 'git.exe')) {
      # MinGit is the official Git for Windows distribution for applications.
      $GitRoot = Join-Path $InstallRoot 'tools\mingit-2.55.0.5'
      $GitCommand = Join-Path $GitRoot 'cmd\git.exe'
      if (-not (Test-GitCommand $GitCommand)) {
        Write-Host 'Downloading Git for Renku skills setup.'
        $GitArchive = Join-Path $Temporary 'mingit.zip'
        Save-RenkuDownload 'https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/MinGit-2.55.0.5-64-bit.zip' $GitArchive
        $GitChecksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $GitArchive).Hash.ToLowerInvariant()
        if ($GitChecksum -ne '56d7b226b7693196cfc71fef26568f536c4a021ab6c37ff2db4287bed908e96e') {
          throw 'INSTALL003 Git archive SHA-256 mismatch.'
        }
        Expand-RenkuArchive $GitArchive $GitRoot
        if (-not (Test-GitCommand $GitCommand)) { throw 'INSTALL008 Downloaded Git failed verification. Rerun the installer to retry.' }
      }
      $env:PATH = "$(Split-Path $GitCommand);$env:PATH"
    }
    Write-Host 'Choose the agents that should receive the Renku skills.'
    Write-Host 'If you cancel, Renku stays installed. Rerun this installer to choose agents again without downloading the same runtime.'
    & $NodeCommand $SkillsEntry add GoRenku/studio-skills --global --skill '*' --copy
    if ($LASTEXITCODE -ne 0) { throw 'INSTALL009 Skills setup did not complete. Renku is installed; rerun this installer to try again.' }
  } finally {
    $env:PATH = $PreviousPath
  }
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'INSTALL001 Renku beta requires 64-bit Windows.'
}
$OsArchitecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($OsArchitecture -ne 'AMD64') { throw 'INSTALL001 Renku beta requires an x64 Windows computer.' }
$Target = 'win32-x64'
if ([Environment]::OSVersion.Version.Major -lt 10) { throw 'INSTALL001 Renku requires Windows 10 or newer.' }
$WindowsSystem = if ([Environment]::Is64BitProcess) { 'System32' } else { 'Sysnative' }
$TarCommand = Join-Path $env:SystemRoot "$WindowsSystem\tar.exe"
if (-not (Test-Path -LiteralPath $TarCommand)) {
  throw 'INSTALL001 Renku requires the archive tool included with Windows 10 version 1803 or newer. Update Windows, then rerun the installer.'
}

if (-not [IO.Path]::IsPathRooted($InstallRoot) -or -not [IO.Path]::IsPathRooted($BinRoot)) {
  throw 'INSTALL004 Installation and launcher folders must be absolute paths.'
}
New-Item -ItemType Directory -Force -Path $InstallRoot, $BinRoot | Out-Null
$Temporary = Join-Path $InstallRoot ('.install-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Temporary | Out-Null
try {
  if ($env:RENKU_UPDATE_SCOPE -eq 'skills') {
    $Destination = $env:RENKU_INSTALLED_PRODUCT
    if (-not $Destination) { throw 'INSTALL004 Installed Renku runtime is required.' }
    $NodeCommand = Join-Path $Destination 'runtime\node\node.exe'
    Install-AgentSkills
    Write-Host 'Skills setup finished. If you confirmed installation, restart your agent and start a new conversation.'
    return
  }
  Write-Host 'Checking the latest Renku release.'
  $ManifestFile = Join-Path $Temporary 'release.json'
  Save-RenkuDownload "$BaseUrl/studio/channels/beta/release.json" $ManifestFile
  try {
    $Manifest = Get-Content -LiteralPath $ManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    throw 'INSTALL002 Could not read the Renku release manifest.'
  }
  $Artifacts = @($Manifest.artifacts | Where-Object { $_.target -eq $Target })
  if ($Artifacts.Count -ne 1 -or $Manifest.version -notmatch '^\d+\.\d+\.\d+$') {
    throw 'INSTALL002 Release manifest has no valid Windows artifact.'
  }
  $Artifact = $Artifacts[0]
  $VersionKey = "studio/releases/$($Manifest.version)/$Target/renku.zip"
  if ($Artifact.versionKey -cne $VersionKey -or $Artifact.sha256 -cnotmatch '^[0-9a-f]{64}$') {
    throw 'INSTALL002 Release manifest has an invalid archive path or checksum.'
  }
  $ArchiveUrl = "$BaseUrl/$VersionKey"
  $VersionsRoot = Join-Path $InstallRoot 'versions'
  $Destination = Join-Path $VersionsRoot $Manifest.version
  if (Test-InstalledRuntime $Destination $Manifest.version) {
    Write-Host "Renku $($Manifest.version) is already installed. Skipping download and continuing to skills setup."
  } else {
    if ($Destination -eq $env:RENKU_INSTALLED_PRODUCT) {
      throw 'INSTALL004 The running Renku installation is incomplete. Stop Studio and rerun the installer in a new terminal to repair it.'
    }
    $Archive = Join-Path $Temporary 'renku.zip'
    Write-Host "Downloading Renku $($Manifest.version) for $Target. This can take a few minutes."
    Save-RenkuDownload $ArchiveUrl $Archive
    $Expected = $Artifact.sha256
    $Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Archive).Hash.ToLowerInvariant()
    if ($Expected -ne $Actual) { throw 'INSTALL003 Renku archive SHA-256 mismatch.' }

    $Extracted = Join-Path $Temporary 'extracted'
    Write-Host 'Download verified. Extracting Renku.'
    Expand-RenkuArchive $Archive $Extracted
    $Product = Join-Path $Extracted 'renku'
    $ReleasePath = Join-Path $Product 'RELEASE.json'
    if (-not (Test-Path -LiteralPath $ReleasePath)) { throw 'INSTALL004 Extracted archive is not a Renku product.' }
    $Release = Get-Content -LiteralPath $ReleasePath -Raw | ConvertFrom-Json
    if ($Release.version -cne $Manifest.version) { throw 'INSTALL004 Extracted release does not match the requested version.' }
    if ($Release.target -cne $Target) { throw 'INSTALL004 Extracted release does not match this platform.' }

    $SmokeNodeCommand = Join-Path $Product 'runtime\node\node.exe'
    $SmokeCliEntry = Join-Path $Product 'app\dist\cli.js'
    & $SmokeNodeCommand $SmokeCliEntry about | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'INSTALL004 Renku CLI smoke validation failed.' }
    & $SmokeNodeCommand (Join-Path $Product 'app\node_modules\skills\bin\cli.mjs') --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'INSTALL006 Bundled skills installer failed verification.' }

    New-Item -ItemType Directory -Force -Path $VersionsRoot, $BinRoot | Out-Null
    $Backup = Join-Path $VersionsRoot ('.previous-' + $Release.version + '-' + $PID)
    if (Test-Path -LiteralPath $Destination) { Move-Item -LiteralPath $Destination -Destination $Backup }
    try {
      Move-Item -LiteralPath $Product -Destination $Destination
    } catch {
      if (Test-Path -LiteralPath $Backup) { Move-Item -LiteralPath $Backup -Destination $Destination }
      throw 'INSTALL004 Could not activate the Renku version.'
    }
    if (Test-Path -LiteralPath $Backup) { Remove-Item -LiteralPath $Backup -Recurse -Force }
  }
  New-Item -ItemType Directory -Force -Path $BinRoot | Out-Null
  $InstallationJson = @{ installRoot = $InstallRoot; binRoot = $BinRoot } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $Destination 'INSTALLATION.json'), $InstallationJson, [Text.UTF8Encoding]::new($false))
  Set-Content -LiteralPath (Join-Path $InstallRoot 'current.txt') -Value $Destination -Encoding utf8

  $NodeCommand = Join-Path $Destination 'runtime\node\node.exe'
  $CliEntry = Join-Path $Destination 'app\dist\cli.js'

  $NodeLiteral = $NodeCommand.Replace("'", "''")
  $CliLiteral = $CliEntry.Replace("'", "''")
  # The public command is a batch launcher. Keep Unicode paths in a BOM-marked
  # PowerShell file, invoked with a process-only execution policy.
  [IO.File]::WriteAllText((Join-Path $BinRoot 'renku-launch.ps1'), "& '$NodeLiteral' '$CliLiteral' @args`nexit `$LASTEXITCODE", [Text.UTF8Encoding]::new($true))
  Set-Content -LiteralPath (Join-Path $BinRoot 'renku.cmd') -Encoding ascii -Value "@echo off`r`nsetlocal DisableDelayedExpansion`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0renku-launch.ps1`" %*`r`nexit /b %errorlevel%"
  # Remove the same-name script so command discovery selects renku.cmd.
  if (Test-Path -LiteralPath (Join-Path $BinRoot 'renku.ps1')) {
    Remove-Item -LiteralPath (Join-Path $BinRoot 'renku.ps1') -Force
  }

  $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
  if ($PathEntries -notcontains $BinRoot) {
    [Environment]::SetEnvironmentVariable('Path', (($PathEntries + $BinRoot) -join ';'), 'User')
    Write-Host "INSTALL005 PATH was saved for future terminals. Renku is also available in this PowerShell window."
  }
  if (@($env:PATH -split ';') -notcontains $BinRoot) {
    $env:PATH = "$BinRoot;$env:PATH"
  }

  Write-Host "`nRenku $($Manifest.version) installed."
  $LauncherLiteral = (Join-Path $BinRoot 'renku.cmd').Replace("'", "''")
  Write-Host "Start Studio: & '$LauncherLiteral' studio start"
  Install-AgentSkills
  Write-Host 'Studio will guide you through choosing its recommended Project Library on first launch.'
  Write-Host 'For a custom location, run renku init <storage-root> before completing setup.'
  Write-Host 'If you confirmed skills installation, restart your agent and start a new conversation to load the Renku skills.'
} finally {
  Remove-Item -LiteralPath $Temporary -Recurse -Force -ErrorAction SilentlyContinue
}
}
