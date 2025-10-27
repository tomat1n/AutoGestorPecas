<#
Backup do projeto AutoGestor Peças (Windows PowerShell)

Uso (via PowerShell):
  powershell -ExecutionPolicy Bypass -File "scripts\backup.ps1" -SourceDir "." -BackupDir ".\backups" -RetentionCount 10

Parâmetros:
  -SourceDir       Pasta do projeto a ser copiada (padrão: raiz do projeto)
  -BackupDir       Pasta onde os arquivos .zip de backup serão salvos (padrão: .\backups)
  -RetentionCount  Quantidade de backups a manter (mais antigos são removidos)

Restauração:
  1) Feche servidores/terminais que estejam usando a pasta do projeto.
  2) Extraia o arquivo .zip do backup para uma pasta temporária.
  3) Faça uma cópia da pasta atual do projeto por segurança.
  4) Substitua o conteúdo da pasta do projeto pelos arquivos extraídos.

Observações:
  - Diretórios voláteis serão excluídos do backup (ex.: .git, node_modules, backups, supabase\.temp).
  - Um arquivo .sha256.txt é gerado para validar a integridade do backup.
#>

[CmdletBinding()]
param(
  [Parameter(Position=0)] [string] $SourceDir = (Split-Path -Parent $PSScriptRoot),
  [Parameter(Position=1)] [string] $BackupDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'),
  [Parameter(Position=2)] [int]    $RetentionCount = 10
)

$ErrorActionPreference = 'Stop'

function Ensure-Directory([string] $Path) {
  if (-not (Test-Path -Path $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null }
}

# Resolve caminhos absolutos
$SourceDir = (Resolve-Path $SourceDir).Path
Ensure-Directory $BackupDir
$BackupDir = (Resolve-Path $BackupDir).Path

# Timestamp e nomes
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$zipName  = "AutoGestorPecas_$timestamp.zip"
$zipPath  = Join-Path $BackupDir $zipName
$tempDir  = Join-Path $BackupDir "tmp_$timestamp"

# Exclusões
$exclusions = @(
  (Join-Path $SourceDir '.git'),
  (Join-Path $SourceDir 'node_modules'),
  (Join-Path $SourceDir 'backups'),
  (Join-Path $SourceDir '.vscode'),
  (Join-Path $SourceDir 'supabase\.temp')
)

Write-Host "Criando pasta temporária: $tempDir"
Ensure-Directory $tempDir

# Monta argumentos do robocopy
$xdArgs = @('/XD') + $exclusions
$xfArgs = @('/XF','*.tmp','Thumbs.db','.DS_Store')
$commonArgs = @($SourceDir, $tempDir, '/MIR', '/R:1', '/W:1')
$robocopyArgs = $commonArgs + $xdArgs + $xfArgs

Write-Host "Copiando arquivos com robocopy (excluindo diretórios voláteis)..."
$rc = Start-Process -FilePath 'robocopy' -ArgumentList $robocopyArgs -NoNewWindow -Wait -PassThru
# 0–3 são considerados sucesso em robocopy
if ($rc.ExitCode -gt 3) { throw "Robocopy falhou com código $($rc.ExitCode)" }

Write-Host "Compactando para: $zipPath"
Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Gerando hash SHA256..."
$hash = Get-FileHash -Algorithm SHA256 -Path $zipPath
$manifestPath = [System.IO.Path]::ChangeExtension($zipPath,'sha256.txt')
"File: $($zipName)`nSHA256: $($hash.Hash)" | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Limpando temporários..."
Remove-Item -Recurse -Force $tempDir

Write-Host "Aplicando política de retenção (mantendo $RetentionCount mais recentes)..."
$backups = Get-ChildItem -Path $BackupDir -Filter '*.zip' | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt $RetentionCount) {
  $toRemove = $backups | Select-Object -Skip $RetentionCount
  foreach ($f in $toRemove) {
    Write-Host "Removendo backup antigo: $($f.FullName)"
    Remove-Item -Force $f.FullName
  }
}

Write-Host "Backup criado com sucesso:" $zipPath