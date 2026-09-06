param([ValidateSet('nsis','msi')][string[]]$Types = @('nsis','msi'))
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $project 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json).version
if (Get-Process vetch101 -ErrorAction SilentlyContinue) { throw 'Close Vetch101 after its work finishes before installer tests.' }
$existing = Get-ItemProperty 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*','HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*' -ErrorAction SilentlyContinue |
    Where-Object DisplayName -EQ 'Vetch101'
if ($existing) { throw 'Vetch101 is already installed. Use a clean Windows test account/VM to avoid replacing it.' }

foreach ($type in $Types) {
    $directory = Join-Path $project "temp/installer-smoke-$type-$([Guid]::NewGuid().ToString('N'))"
    New-Item $directory -ItemType Directory | Out-Null
    $log = Join-Path $directory 'install.log'
    if ($type -eq 'nsis') {
        $installer = Join-Path $project "dist-desktop/Vetch101_${version}_x64-setup.exe"
        # NSIS /D must be last; everything after '=' is the install path, including spaces.
        $install = Start-Process -FilePath $installer -ArgumentList "/S /D=$directory" -WindowStyle Hidden -Wait -PassThru
    } else {
        $installer = Join-Path $project "dist-desktop/Vetch101_${version}_x64_en-US.msi"
        $install = Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /qn /norestart INSTALLDIR=`"$directory`" /L*v `"$log`"" -WindowStyle Hidden -Wait -PassThru
    }
    if ($install.ExitCode -ne 0) { throw "$type install failed ($($install.ExitCode)); inspect $directory before retrying." }
    Write-Host "PASS $type install: $directory"
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $installedHash = [Convert]::ToBase64String($sha.ComputeHash([IO.File]::ReadAllBytes((Join-Path $directory 'WebView2Loader.dll'))))
            $sourceHash = [Convert]::ToBase64String($sha.ComputeHash([IO.File]::ReadAllBytes((Join-Path $project 'WebView2Loader.dll'))))
            if ($installedHash -ne $sourceHash) { throw 'Installed WebView2Loader.dll differs from release.' }
        } finally { $sha.Dispose() }
        # Tauri patches EXE bundle-type bytes separately for NSIS/MSI, so their full hashes differ.
        $installedVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $directory 'Vetch101.exe')).ProductVersion
        if ($installedVersion -ne $version) { throw "Unexpected installed version: $installedVersion" }
        & "$PSScriptRoot/test-portable.ps1" -Directories $directory
    } finally {
        if (Get-Process vetch101 -ErrorAction SilentlyContinue) { throw "App is still running; test installation left at $directory for inspection." }
        # Only uninstall the product this run just installed; existing installs were rejected above.
        if ($type -eq 'nsis') {
            $uninstall = Start-Process -FilePath (Join-Path $directory 'uninstall.exe') -ArgumentList "/S _?=$directory" -WindowStyle Hidden -Wait -PassThru
        } else {
            $uninstall = Start-Process msiexec.exe -ArgumentList "/x `"$installer`" /qn /norestart /L*v `"$directory/uninstall.log`"" -WindowStyle Hidden -Wait -PassThru
        }
        if ($uninstall.ExitCode -ne 0) { throw "$type uninstall failed ($($uninstall.ExitCode)); inspect $directory." }
        if (Test-Path -LiteralPath (Join-Path $directory 'Vetch101.exe')) { throw "$type uninstall left the app executable: $directory" }
        Write-Host "PASS $type uninstall (test logs retained): $directory"
    }
}
