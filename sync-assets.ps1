# Sync web assets to Android app assets
$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetAssets = Join-Path $sourceDir "android_app\app\src\main\assets"
$targetDrawable = Join-Path $sourceDir "android_app\app\src\main\res\drawable"

$webFiles = @(
    "index.html",
    "style.css",
    "script.js",
    "manifest.json",
    "logo.png"
)

Write-Host "Syncing web assets to Android..." -ForegroundColor Cyan

$copied = 0
$skipped = 0

function Sync-File {
    param($src, $dst, $label)
    if (-not (Test-Path $src)) {
        Write-Host "  [WARN] $label not found" -ForegroundColor Yellow
        return $false
    }
    if (Test-Path $dst) {
        $srcHash = (Get-FileHash $src -Algorithm MD5).Hash
        $dstHash = (Get-FileHash $dst -Algorithm MD5).Hash
        if ($srcHash -eq $dstHash) {
            Write-Host "  [SKIP] $label (no changes)" -ForegroundColor DarkGray
            return $false
        }
    }
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "  [OK]   $label" -ForegroundColor Green
    return $true
}

foreach ($file in $webFiles) {
    $src = Join-Path $sourceDir $file
    $dst = Join-Path $targetAssets $file
    if (Sync-File $src $dst $file) { $copied++ } else { $skipped++ }
}

# logo.png also needed in drawable/ for Android resources (notification, splash)
$src = Join-Path $sourceDir "logo.png"
$dst = Join-Path $targetDrawable "logo.png"
if (Sync-File $src $dst "logo.png (drawable)") { $copied++ } else { $skipped++ }

Write-Host ""
Write-Host "Done: $copied copied, $skipped skipped" -ForegroundColor Cyan
