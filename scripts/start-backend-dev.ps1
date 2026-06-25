param(
    [int]$Port = 5103,
    [string]$Urls = "http://0.0.0.0:5103"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $root "bin\Debug\net9.0"
$runDir = Join-Path $root ".dev-server\backend"
$stdoutLog = Join-Path $root ".backend.out.log"
$stderrLog = Join-Path $root ".backend.err.log"

Set-Location $root

function Stop-ExistingBackend {
    $candidatePids = New-Object System.Collections.Generic.List[int]

    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.OwningProcess) {
                [void]$candidatePids.Add([int]$_.OwningProcess)
            }
        }

    $rootPattern = [regex]::Escape($root.Path)
    Get-CimInstance Win32_Process |
        Where-Object {
            ($_.Name -eq "NhaTro.exe") -or
            ($_.Name -eq "dotnet.exe" -and (
                $_.CommandLine -like "*NhaTro.dll*" -or
                $_.CommandLine -like "*dotnet run*" -or
                $_.CommandLine -like "*:$Port*" -or
                $_.CommandLine -match $rootPattern
            ))
        } |
        ForEach-Object {
            [void]$candidatePids.Add([int]$_.ProcessId)
        }

    $candidatePids |
        Sort-Object -Unique |
        ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
}

Stop-ExistingBackend
Start-Sleep -Milliseconds 700

dotnet build --no-restore
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

New-Item -ItemType Directory -Path $runDir -Force | Out-Null
Copy-Item -Path (Join-Path $sourceDir "*") -Destination $runDir -Recurse -Force

if (Test-Path $stdoutLog) {
    Remove-Item -LiteralPath $stdoutLog -Force
}

if (Test-Path $stderrLog) {
    Remove-Item -LiteralPath $stderrLog -Force
}

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:DOTNET_ENVIRONMENT = "Development"

$process = Start-Process `
    -FilePath "dotnet" `
    -ArgumentList @("NhaTro.dll", "--urls", $Urls) `
    -WorkingDirectory $runDir `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden `
    -PassThru

Start-Sleep -Seconds 3

Write-Host "Backend started: PID $($process.Id)"
Write-Host "URL: $Urls"
Write-Host "Runtime dir: $runDir"
