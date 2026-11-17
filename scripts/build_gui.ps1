<#
.SYNOPSIS
    Build SecWin GUI for Windows

.DESCRIPTION
    Builds the Tauri GUI application for Windows distribution.
    Supports both development and production builds.

.NOTES
    Requires: Node.js 20+, Rust 1.79+, Tauri CLI
#>

param(
    [switch]$Dev,
    [switch]$Clean,
    [string]$Target = "universal"
)

$ErrorActionPreference = "Stop"

$guiDir = Join-Path $PSScriptRoot "..\gui"

Write-Host "SecWin GUI Builder" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "Directory: $guiDir" -ForegroundColor Gray

if (-not (Test-Path $guiDir)) {
    Write-Error "GUI directory not found: $guiDir"
    exit 1
}

Set-Location $guiDir

# Check prerequisites
Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

$prereqs = @(
    @{ Name = "Node.js"; Cmd = "node --version" },
    @{ Name = "npm"; Cmd = "npm --version" },
    @{ Name = "Rust"; Cmd = "cargo --version" },
    @{ Name = "Tauri CLI"; Cmd = "cargo tauri --version" }
)

foreach ($prereq in $prereqs) {
    try {
        $output = Invoke-Expression $prereq.Cmd 2>$null
        Write-Host "  ✓ $($prereq.Name): $output.Trim()" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $($prereq.Name): NOT FOUND" -ForegroundColor Red
        $missing = $true
    }
}

if ($missing) {
    Write-Error "Missing prerequisites. Please install required tools."
    exit 1
}

# Clean if requested
if ($Clean) {
    Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
    if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
    if (Test-Path "src-tauri/target") { Remove-Item -Recurse -Force "src-tauri/target" }
    if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
    Write-Host "  Clean complete" -ForegroundColor Green
}

# Install dependencies
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Yellow
npm ci

# Build
Write-Host "`nBuilding Tauri application..." -ForegroundColor Yellow

$tauriArgs = @("tauri", "build")
if ($Dev) {
    $tauriArgs = @("tauri", "dev")
}

if ($Target -ne "universal") {
    $tauriArgs += "--target", $Target
}

Write-Host "Running: cargo $($tauriArgs -join ' ')" -ForegroundColor Gray

try {
    cargo $tauriArgs
    Write-Host "`n✓ Build successful!" -ForegroundColor Green

    if (-not $Dev) {
        $bundleDir = "src-tauri\target\release\bundle"
        if (Test-Path $bundleDir) {
            Write-Host "`nOutput files:" -ForegroundColor Cyan
            Get-ChildItem $bundleDir -Recurse -File | Where-Object { $_.Extension -in @(".msi", ".exe", ".appimage", ".deb", ".rpm", ".dmg") } | ForEach-Object {
                Write-Host "  $($_.FullName)" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Error "Build failed: $_"
    exit 1
}

Write-Host "`nDone!" -ForegroundColor Cyan