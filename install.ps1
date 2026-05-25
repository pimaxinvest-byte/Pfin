# ╔══════════════════════════════════════════════════╗
# ║   SA Market Dashboard — Windows Installer        ║
# ║   Daloopa · 2026                                 ║
# ╚══════════════════════════════════════════════════╝

param(
    [switch]$Uninstall
)

$AppName    = "SA Market Dashboard"
$ExeName    = "sa-dashboard.exe"
$InstallDir = "$env:LOCALAPPDATA\SADashboard"
$ExePath    = "$InstallDir\$ExeName"
$Desktop    = "$env:USERPROFILE\Desktop"
$StartMenu  = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$StartupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

function Write-Step($msg) {
    Write-Host "  → $msg" -ForegroundColor Cyan
}
function Write-Ok($msg) {
    Write-Host "  ✅ $msg" -ForegroundColor Green
}
function Write-Err($msg) {
    Write-Host "  ❌ $msg" -ForegroundColor Red
}

# ── UNINSTALL ──────────────────────────────────────────────────
if ($Uninstall) {
    Write-Host "`n  Desinstalando $AppName..." -ForegroundColor Yellow
    Remove-Item "$Desktop\$AppName.lnk"         -ErrorAction SilentlyContinue
    Remove-Item "$StartMenu\$AppName.lnk"       -ErrorAction SilentlyContinue
    Remove-Item "$StartupDir\$AppName.lnk"      -ErrorAction SilentlyContinue
    Remove-Item $InstallDir -Recurse -Force      -ErrorAction SilentlyContinue
    Write-Ok "Desinstalado correctamente."
    exit 0
}

# ── INSTALL ────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "║   SA Market Dashboard — Instalador               ║" -ForegroundColor DarkCyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""

# Verify source exe exists
$SourceExe = Join-Path $PSScriptRoot $ExeName
if (-not (Test-Path $SourceExe)) {
    Write-Err "No se encontró $ExeName en la misma carpeta que este script."
    Write-Host "  Asegúrate de que '$ExeName' esté junto a 'install.ps1'" -ForegroundColor Yellow
    exit 1
}

# 1. Create install directory
Write-Step "Creando directorio de instalación..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Write-Ok $InstallDir

# 2. Copy executable
Write-Step "Copiando ejecutable..."
Copy-Item $SourceExe $ExePath -Force
Write-Ok "sa-dashboard.exe instalado"

# 3. Desktop shortcut
Write-Step "Creando acceso directo en el Escritorio..."
$WshShell = New-Object -ComObject WScript.Shell
$sc = $WshShell.CreateShortcut("$Desktop\$AppName.lnk")
$sc.TargetPath       = $ExePath
$sc.WorkingDirectory = $InstallDir
$sc.Description      = "SA Market Dashboard — Live Stock Prices"
$sc.Save()
Write-Ok "Acceso directo creado en el Escritorio"

# 4. Start Menu shortcut
Write-Step "Creando acceso en el Menú de Inicio..."
$sc2 = $WshShell.CreateShortcut("$StartMenu\$AppName.lnk")
$sc2.TargetPath       = $ExePath
$sc2.WorkingDirectory = $InstallDir
$sc2.Description      = "SA Market Dashboard — Live Stock Prices"
$sc2.Save()
Write-Ok "Menú de Inicio actualizado"

# 5. Ask for startup
Write-Host ""
$resp = Read-Host "  ¿Iniciar automáticamente con Windows? (s/n)"
if ($resp -match '^[sS]') {
    $sc3 = $WshShell.CreateShortcut("$StartupDir\$AppName.lnk")
    $sc3.TargetPath       = $ExePath
    $sc3.WorkingDirectory = $InstallDir
    $sc3.Save()
    Write-Ok "Configurado para iniciar con Windows"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅  Instalación completada                     ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║   Usa el icono del Escritorio para abrir la app  ║" -ForegroundColor Green
Write-Host "║   La app abre en tu browser en localhost:8080    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# 6. Launch now?
$launch = Read-Host "  ¿Abrir el dashboard ahora? (s/n)"
if ($launch -match '^[sS]') {
    Start-Process $ExePath
    Start-Sleep 1
    Start-Process "http://localhost:8080"
}
