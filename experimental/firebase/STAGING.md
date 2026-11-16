# Homologação real — preparação, não ativação
Baseline: commit 356a9ab, 369 regressões + 8 testes emulator aprovados.
## Configuração externa necessária
Criar um projeto Firebase separado de produção, registrar app Web, habilitar Google Authentication, cadastrar domínio HTTPS de homologação e criar Firestore em modo fechado. Confirmar região e custos do plano Blaze antes de provisionar Functions. Não enviar conta de serviço, senha, token ou chave privada ao GitHub. Registrar apenas configuração pública do SDK após verificar o ID de projeto.
## Gates de código
Manter o entrypoint atual exclusivamente local. Criar entrypoint separado de staging com allowlist explícita de projectId e UID de testadores, verificação de provedor Google no token, App Check, limites de requisições e regras fechadas. Não remover a guarda do emulador. Usar dados sintéticos somente. Criar fila IndexedDB particionada por projeto e UID, persistindo operação e revisão antes do envio; recuperar recibo antes de repetir. Bloquear conflito sem sobrescrever. Não carregar fila de outro UID após logout.
## Aceitação física
A mesma conta em PC e celular deve ler a mesma revisão após alteração; segunda conta deve ter estado independente. Testar Safari iOS e Chrome Android, cancelamento de login, reconexão/reabertura, logout, conflito concorrente, recuperação de recibo, acesso direto negado. Nenhuma migração de backup real até autorização específica. Nenhum deploy autorizado neste pacote.
Referências: https://firebase.google.com/docs/auth/web/google-signin e https://firebase.google.com/docs/projects/dev-workflows/general-best-practices
