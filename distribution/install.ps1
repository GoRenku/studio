$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BaseUrl = if ($env:RENKU_DOWNLOAD_BASE_URL) { $env:RENKU_DOWNLOAD_BASE_URL } else { 'https://downloads.gorenku.com' }
$InstallRoot = if ($env:RENKU_INSTALL_ROOT) { $env:RENKU_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA 'Renku' }
$BinRoot = if ($env:RENKU_BIN_ROOT) { $env:RENKU_BIN_ROOT } else { Join-Path $InstallRoot 'bin' }

function Test-GitCommand([string]$Command) {
  try {
    & $Command --version 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Install-AgentSkills {
  $NpxEntry = Join-Path $Destination 'runtime\node\node_modules\npm\bin\npx-cli.js'
  if (-not (Test-Path $NpxEntry)) { throw 'INSTALL006 Bundled npm is missing. Renku is installed, but skills setup cannot continue.' }
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
        Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/MinGit-2.55.0.5-64-bit.zip' -OutFile $GitArchive
        $GitChecksum = (Get-FileHash -Algorithm SHA256 $GitArchive).Hash.ToLowerInvariant()
        if ($GitChecksum -ne '56d7b226b7693196cfc71fef26568f536c4a021ab6c37ff2db4287bed908e96e') {
          throw 'INSTALL003 Git archive SHA-256 mismatch.'
        }
        Expand-Archive -Path $GitArchive -DestinationPath $GitRoot -Force
        if (-not (Test-GitCommand $GitCommand)) { throw 'INSTALL008 Downloaded Git failed verification. Rerun the installer to retry.' }
      }
      $env:PATH = "$(Split-Path $GitCommand);$env:PATH"
    }
    Write-Host 'Choose the agents that should receive the Renku skills.'
    & $NodeCommand $NpxEntry --yes skills add GoRenku/studio-skills --global --skill '*' --copy
    if ($LASTEXITCODE -ne 0) { throw 'INSTALL009 Skills setup did not complete. Renku is installed; rerun this installer to try again.' }
  } finally {
    $env:PATH = $PreviousPath
  }
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'INSTALL001 Renku beta requires 64-bit Windows.'
}
$Target = 'win32-x64'

$Temporary = Join-Path ([IO.Path]::GetTempPath()) ("renku-install-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Temporary | Out-Null
try {
  if ($env:RENKU_UPDATE_SCOPE -eq 'skills') {
    $Destination = $env:RENKU_INSTALLED_PRODUCT
    if (-not $Destination) { throw 'INSTALL004 Installed Renku runtime is required.' }
    $NodeCommand = Join-Path $Destination 'runtime\node\node.exe'
    Install-AgentSkills
    Write-Host 'Renku skills updated. Restart your agent and start a new conversation.'
    return
  }
  $ArchiveUrl = "$BaseUrl/studio/channels/beta/$Target/renku.zip"
  $Archive = Join-Path $Temporary 'renku.zip'
  $Checksum = Join-Path $Temporary 'renku.zip.sha256'
  Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $Archive
  Invoke-WebRequest -UseBasicParsing -Uri "$ArchiveUrl.sha256" -OutFile $Checksum
  $Expected = ((Get-Content $Checksum -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
  $Actual = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
  if ($Expected -ne $Actual) { throw 'INSTALL003 Renku archive SHA-256 mismatch.' }

  $Extracted = Join-Path $Temporary 'extracted'
  Expand-Archive -Path $Archive -DestinationPath $Extracted
  $Product = Join-Path $Extracted 'renku'
  $ReleasePath = Join-Path $Product 'RELEASE.json'
  if (-not (Test-Path $ReleasePath)) { throw 'INSTALL004 Extracted archive is not a Renku product.' }
  $Release = Get-Content $ReleasePath -Raw | ConvertFrom-Json

  $SmokeNodeCommand = Join-Path $Product 'runtime\node\node.exe'
  $SmokeCliEntry = Join-Path $Product 'app\dist\cli.js'
  & $SmokeNodeCommand $SmokeCliEntry about | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'INSTALL004 Renku CLI smoke validation failed.' }

  $VersionsRoot = Join-Path $InstallRoot 'versions'
  New-Item -ItemType Directory -Force -Path $VersionsRoot, $BinRoot | Out-Null
  $Destination = Join-Path $VersionsRoot $Release.version
  $Backup = Join-Path $VersionsRoot ('.previous-' + $Release.version + '-' + $PID)
  if ($env:RENKU_UPDATE_SCOPE -eq 'all' -and $Destination -eq $env:RENKU_INSTALLED_PRODUCT) {
    Write-Host "Renku $($Release.version) is already installed. Updating skills."
  } else {
    if (Test-Path $Destination) { Move-Item $Destination $Backup }
    try {
      Move-Item $Product $Destination
    } catch {
      if (Test-Path $Backup) { Move-Item $Backup $Destination }
      throw 'INSTALL004 Could not activate the Renku version.'
    }
    if (Test-Path $Backup) { Remove-Item -Recurse -Force $Backup }
  }
  $InstallationJson = @{ installRoot = $InstallRoot; binRoot = $BinRoot } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $Destination 'INSTALLATION.json'), $InstallationJson, [Text.UTF8Encoding]::new($false))
  Set-Content -Path (Join-Path $InstallRoot 'current.txt') -Value $Destination -Encoding utf8

  $NodeCommand = Join-Path $Destination 'runtime\node\node.exe'
  $CliEntry = Join-Path $Destination 'app\dist\cli.js'

  $NodeLiteral = $NodeCommand.Replace("'", "''")
  $CliLiteral = $CliEntry.Replace("'", "''")
  Set-Content -Path (Join-Path $BinRoot 'renku.ps1') -Encoding utf8 -Value "& '$NodeLiteral' '$CliLiteral' @args`nexit `$LASTEXITCODE"
  Set-Content -Path (Join-Path $BinRoot 'renku.cmd') -Encoding ascii -Value "@`"$NodeCommand`" `"$CliEntry`" %*"

  $UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
  if ($PathEntries -notcontains $BinRoot) {
    [Environment]::SetEnvironmentVariable('Path', (($PathEntries + $BinRoot) -join ';'), 'User')
    Write-Host "INSTALL005 PATH was updated for future processes. Restart terminals and agent desktop apps."
  }

  Write-Host "`nRenku $($Release.version) installed."
  Install-AgentSkills
  Write-Host "Start Studio: $BinRoot\renku.cmd studio start"
  Write-Host 'Studio will guide you through choosing its recommended Project Library on first launch.'
  Write-Host 'For a custom location, run renku init <storage-root> before completing setup.'
  Write-Host 'Restart your agent and start a new conversation to load the Renku skills.'
} finally {
  Remove-Item -Recurse -Force $Temporary -ErrorAction SilentlyContinue
}
