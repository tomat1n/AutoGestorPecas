# Script para push automático para GitHub
# Uso: .\scripts\auto-push.ps1 "Mensagem do commit"

param(
    [string]$CommitMessage = "Auto update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

Write-Host "Iniciando push automatico para GitHub..." -ForegroundColor Green

# Verificar se há alterações
$status = git status --porcelain
if (-not $status) {
    Write-Host "Nenhuma alteracao detectada." -ForegroundColor Yellow
    exit 0
}

Write-Host "Alteracoes detectadas:" -ForegroundColor Cyan
git status --short

# Adicionar todas as alterações
Write-Host "Adicionando alteracoes..." -ForegroundColor Blue
git add .

# Fazer commit
Write-Host "Fazendo commit: $CommitMessage" -ForegroundColor Blue
git commit -m $CommitMessage

# Push para GitHub
Write-Host "Enviando para GitHub..." -ForegroundColor Blue
$pushResult = git push 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Push realizado com sucesso!" -ForegroundColor Green
    Write-Host "Projeto atualizado no GitHub: https://github.com/tomat1n/AutoGestorPecas" -ForegroundColor Cyan
} else {
    Write-Host "Erro no push:" -ForegroundColor Red
    Write-Host $pushResult -ForegroundColor Red
    exit 1
}