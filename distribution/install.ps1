$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BaseUrl = if ($env:RENKU_DOWNLOAD_BASE_URL) { $env:RENKU_DOWNLOAD_BASE_URL } else { 'https://downloads.gorenku.com' }
$InstallRoot = if ($env:RENKU_INSTALL_ROOT) { $env:RENKU_INSTALL_ROOT } else { Join-Path $env:LOCALAPPDATA 'Renku' }
$BinRoot = if ($env:RENKU_BIN_ROOT) { $env:RENKU_BIN_ROOT } else { Join-Path $InstallRoot 'bin' }

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'INSTALL001 Renku beta requires 64-bit Windows.'
}
$Target = 'win32-x64'
$Flavor = 'bundled-node24'
$NodeCommand = $null
$Node = Get-Command node -ErrorAction SilentlyContinue
if ($Node) {
  $NodeVersion = (& $Node.Source -p 'process.versions.node').Trim()
  $Parts = $NodeVersion.Split('.')
  if ($Parts[0] -eq '24') {
    $Flavor = 'node24'
    $NodeCommand = $Node.Source
  } elseif ($Parts[0] -eq '22' -and [int]$Parts[1] -ge 12) {
    $Flavor = 'node22'
    $NodeCommand = $Node.Source
  }
}
if ($Flavor -eq 'bundled-node24') {
  Write-Host 'INSTALL006 No supported system Node was found; Renku will use its private Node 24 runtime.'
}

$Temporary = Join-Path ([IO.Path]::GetTempPath()) ("renku-install-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Temporary | Out-Null
try {
  $ArchiveUrl = "$BaseUrl/studio/channels/beta/$Target/$Flavor/renku.zip"
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

  $SmokeNodeCommand = if ($Flavor -eq 'bundled-node24') { Join-Path $Product 'runtime\node\node.exe' } else { $NodeCommand }
  $SmokeCliEntry = Join-Path $Product 'app\dist\cli.js'
  & $SmokeNodeCommand $SmokeCliEntry about | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'INSTALL004 Renku CLI smoke validation failed.' }

  $VersionsRoot = Join-Path $InstallRoot 'versions'
  New-Item -ItemType Directory -Force -Path $VersionsRoot, $BinRoot | Out-Null
  $Destination = Join-Path $VersionsRoot $Release.version
  $Backup = Join-Path $VersionsRoot ('.previous-' + $Release.version + '-' + $PID)
  if (Test-Path $Destination) { Move-Item $Destination $Backup }
  try {
    Move-Item $Product $Destination
  } catch {
    if (Test-Path $Backup) { Move-Item $Backup $Destination }
    throw 'INSTALL004 Could not activate the Renku version.'
  }
  if (Test-Path $Backup) { Remove-Item -Recurse -Force $Backup }
  Set-Content -Path (Join-Path $InstallRoot 'current.txt') -Value $Destination -Encoding utf8

  if ($Flavor -eq 'bundled-node24') { $NodeCommand = Join-Path $Destination 'runtime\node\node.exe' }
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
  Write-Host "Start Studio: $BinRoot\renku.cmd studio start"
  Write-Host "INSTALL007 Enable the bundled Renku plugin in Codex or Claude Code."
  Write-Host "Bundled plugin marketplace: $Destination\plugin"
} finally {
  Remove-Item -Recurse -Force $Temporary -ErrorAction SilentlyContinue
}
