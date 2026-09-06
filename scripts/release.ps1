$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = Split-Path -Parent $PSScriptRoot
$releaseLock = [System.Threading.Mutex]::new($false, 'Local\Vetch101Release')
$locked = $false
$sha = [System.Security.Cryptography.SHA256]::Create()
function ArtifactHash([string]$path) {
    [Convert]::ToBase64String($sha.ComputeHash([System.IO.File]::ReadAllBytes($path)))
}
Push-Location $project
try {
    $locked = $releaseLock.WaitOne(0)
    if (!$locked) { throw 'Another Vetch101 release is running.' }
    if (Get-Process cargo,rustc -ErrorAction SilentlyContinue) {
        throw 'Cargo/Rust is already running. Wait for it to finish before releasing.'
    }
    if (Get-Process vetch101 -ErrorAction SilentlyContinue) {
        throw 'Vetch101 is running. Close it after its work finishes; this script never stops user downloads.'
    }
    Push-Location src-tauri
    try {
        $metadataJson = & cargo metadata --format-version 1 --no-deps
        if ($LASTEXITCODE -ne 0) { throw 'cargo metadata failed.' }
        $targetDir = ($metadataJson | ConvertFrom-Json).target_directory
        $config = Get-Content .cargo/config.toml -Raw
        if ($config -notmatch '(?m)^target\s*=\s*"([^"]+)"') { throw 'Missing Cargo target.' }
        $targetTriple = $Matches[1]
    } finally { Pop-Location }
    $version = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
    $release = Join-Path $targetDir "$targetTriple/release"
    $logDir = Join-Path $project 'logs'
    New-Item $logDir -ItemType Directory -Force | Out-Null
    $log = Join-Path $logDir 'release.log'
    # Windows PowerShell represents normal native stderr as ErrorRecord objects.
    $ErrorActionPreference = 'Continue'
    try {
        & npm.cmd run tauri build 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log -ErrorAction Stop
        $buildExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = 'Stop' }
    if ($buildExit -ne 0) { throw "Tauri build failed; see $log" }
    if (Select-String -LiteralPath $log -Pattern 'rsrc merge failure|multiple non-default manifests' -Quiet) {
        throw 'Conflicting Windows manifests; artifacts were not copied.'
    }
    $dist = Join-Path $project 'dist-desktop'
    New-Item $dist -ItemType Directory -Force | Out-Null
    $copies = @(
        @{ Source = "$release/vetch101.exe"; Dest = "$project/Vetch101.exe" },
        @{ Source = "$release/WebView2Loader.dll"; Dest = "$project/WebView2Loader.dll" },
        @{ Source = "$release/vetch101.exe"; Dest = "$dist/Vetch101.exe" },
        @{ Source = "$release/WebView2Loader.dll"; Dest = "$dist/WebView2Loader.dll" },
        @{ Source = "$release/bundle/nsis/Vetch101_${version}_x64-setup.exe"; Dest = "$dist/Vetch101_${version}_x64-setup.exe" },
        @{ Source = "$release/bundle/msi/Vetch101_${version}_x64_en-US.msi"; Dest = "$dist/Vetch101_${version}_x64_en-US.msi" }
    )
    foreach ($copy in $copies) {
        if (!(Test-Path -LiteralPath $copy.Source -PathType Leaf) -or (Get-Item -LiteralPath $copy.Source).Length -eq 0) {
            throw "Missing or empty artifact: $($copy.Source)"
        }
    }
    if (Get-Process vetch101 -ErrorAction SilentlyContinue) { throw 'Vetch101 was opened during build; no artifacts copied.' }
    foreach ($copy in $copies) {
        Copy-Item -LiteralPath $copy.Source -Destination $copy.Dest -Force
        if ((ArtifactHash $copy.Source) -ne (ArtifactHash $copy.Dest)) {
            throw "Copy verification failed: $($copy.Dest)"
        }
    }
    & "$PSScriptRoot/test-portable.ps1"
    Write-Host "Release copied and portable launch checked. Installer runtime checks are separate. Log: $log"
} finally {
    Pop-Location
    if ($locked) { $releaseLock.ReleaseMutex() }
    $releaseLock.Dispose()
    $sha.Dispose()
}
