$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Set-Location ..
$workbench = (Get-Location).Path

function Invoke-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE). See the output above." }
}

Write-Host 'Apollo See-through: Windows GPU setup' -ForegroundColor Cyan
if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
    throw 'NVIDIA driver not detected. Install/update the NVIDIA driver on the 4090 PC, then run this installer again.'
}
Invoke-Checked 'nvidia-smi' @()

$python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
if (-not (Test-Path $python)) {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) {
        try { $found = & py -3.12 -c 'import sys;print(sys.executable)' 2>$null }
        catch { $found = $null }
        if ($LASTEXITCODE -eq 0 -and $found) { $python = $found.Trim() }
    }
}
if (-not (Test-Path $python)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Install Python 3.12 from python.org, then rerun this installer. Windows App Installer/winget is unavailable.' }
    Invoke-Checked 'winget' @('install','--exact','--id','Python.Python.3.12','--scope','user','--accept-package-agreements','--accept-source-agreements')
    $python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
    if (-not (Test-Path $python)) { throw 'Python was installed in a custom location. Rerun after making Python 3.12 available with the py launcher.' }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows, then rerun this installer.' }
    Invoke-Checked 'winget' @('install','--exact','--id','Git.Git','--scope','user','--accept-package-agreements','--accept-source-agreements')
    $env:PATH = "$env:LOCALAPPDATA\Programs\Git\cmd;$env:ProgramFiles\Git\cmd;$env:PATH"
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git installation finished. Restart this installer so the new PATH takes effect.' }
}
Invoke-Checked $python @('-c','import sys;assert sys.version_info[:2] == (3,12), "Python 3.12 required"')
$envPython = Join-Path $workbench '.venv\Scripts\python.exe'
if (-not (Test-Path $envPython)) { Invoke-Checked $python @('-m','venv',(Join-Path $workbench '.venv')) }
Invoke-Checked $envPython @('-m','pip','install','--upgrade','pip')
Invoke-Checked $envPython @('-m','pip','install','torch==2.8.0+cu128','torchvision==0.23.0+cu128','torchaudio==2.8.0+cu128','--index-url','https://download.pytorch.org/whl/cu128')
Invoke-Checked $envPython @((Join-Path $PSScriptRoot 'check-gpu.py'))

Push-Location (Join-Path $workbench 'vendor\see-through')
try {
    Invoke-Checked $envPython @('-m','pip','install','-r','requirements.txt','-c',(Join-Path $PSScriptRoot 'torch-constraints.txt'))
    Invoke-Checked $envPython @('-m','pip','check')
} finally { Pop-Location }
Invoke-Checked $envPython @((Join-Path $PSScriptRoot 'check-gpu.py'))
Write-Host 'GPU + base dependencies verified. Drag a character image onto windows\Run-Image.cmd to run the original pipeline. First run downloads model weights.' -ForegroundColor Green
Write-Host 'Optional detectron2/SAM2/mmcv tiers are separate upstream dependencies; they are not installed by this base installer.'
