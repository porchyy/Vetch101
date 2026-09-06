param([string[]]$Directories = @((Split-Path -Parent $PSScriptRoot), (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist-desktop')))
$ErrorActionPreference = 'Stop'

if (-not ('NativeMethods' -as [type])) {
    Add-Type @'
    using System;
    using System.Text;
    using System.Runtime.InteropServices;

    public static class NativeMethods {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        public const uint WM_CLOSE = 0x0010;

        public static IntPtr FindWindowByProcessAndTitle(uint processId, string expectedTitle) {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (pid == processId) {
                    StringBuilder sb = new StringBuilder(512);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    if (sb.ToString() == expectedTitle) {
                        found = hWnd;
                        return false;
                    }
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }
    }
'@
}

$expectedTitle = 'Vetch101 - Video Downloader'

foreach ($directory in $Directories) {
    $exe = Join-Path $directory 'Vetch101.exe'
    if (!(Test-Path -LiteralPath (Join-Path $directory 'WebView2Loader.dll') -PathType Leaf)) {
        throw "Missing WebView2Loader.dll: $directory"
    }
    # Launch the actual GUI deliberately; only this newly started idle test process is closed.
    $app = Start-Process -FilePath $exe -WorkingDirectory $directory -PassThru
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(25)
        $targetHwnd = [IntPtr]::Zero
        do {
            Start-Sleep -Milliseconds 200
            $app.Refresh()
            if ($app.MainWindowTitle -eq $expectedTitle -and $app.MainWindowHandle -ne [IntPtr]::Zero) {
                $targetHwnd = $app.MainWindowHandle
            } else {
                $targetHwnd = [NativeMethods]::FindWindowByProcessAndTitle($app.Id, $expectedTitle)
            }
        } while (!$app.HasExited -and $targetHwnd -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline)

        if ($app.HasExited) { throw "Launch failed ($($app.ExitCode)): $exe" }
        if ($targetHwnd -eq [IntPtr]::Zero) { throw "Expected main window was not found: $exe" }

        $closed = [NativeMethods]::PostMessage($targetHwnd, [NativeMethods]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
        if (!$closed) {
            $closed = $app.CloseMainWindow()
        }
        if (!$closed -or !$app.WaitForExit(25000)) { throw "Close/cleanup timed out: $exe" }
        if ($app.ExitCode -ne 0) { throw "Close failed ($($app.ExitCode)): $exe" }
        Write-Host "PASS launch + graceful close: $exe"
    } finally {
        if (!$app.HasExited) { Write-Warning "Test process $($app.Id) remains open; inspect it before retrying." }
        $app.Dispose()
    }
}

