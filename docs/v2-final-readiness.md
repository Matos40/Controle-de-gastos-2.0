# Raytech CG — preparação para implantação definitiva

Base: 13a4aef1e2b8c01705841a756abc5504de306a4d. T01–T09 aprovados pelo usuário em testes locais; T01 acessado por URL direta, T08 restaurado com o arquivo correto V2 após rejeição de arquivo legado. O isolamento local foi confirmado pelo usuário. Nenhum teste real de transferência financeira foi aprovado nesta etapa.

Este PR corrige a navegação por confirmação interna e antecipa a validação estrita de backups V2. Não ativa transferências nem migra dados. Testes de navegador utilizam apenas fixtures sintéticas.

## Condições para a próxima fase
- Preservar integralmente o banco legado e o banco de testes `raytech_cg_v2_clean_finance_v1`, incluindo backups e metadados.
- Criar namespace novo para o banco principal V2, com metadados de sincronização e lock próprios. Inicializar vazio somente por ação autorizada; nunca copiar dados de testes ou legado automaticamente.
- Separar o modo de testes do modo definitivo, bloquear envios de testes no adaptador mesmo se a configuração de sincronização for habilitada futuramente.
- Definir comportamento de backup entre espaços, restauração e rollback antes de tornar o V2 padrão.
- Validar nova chave, isolamento triplo, reabertura, PWA, offline, exportação/restauração, regras e consumo Spark com dados fictícios isolados.
- Manter `syncEnabled:false` até aprovação específica da sincronização. Verificar conta e estado da nuvem antes de qualquer vínculo. Nunca enviar dados fictícios ao Firestore de produção.
- Preservar PRs #7 e #12. Nenhuma alteração nas regras Firebase ou publicação por este PR.

## Candidato de armazenamento principal
- URL explícita `?workspace=v2-main`; a página sem query continua sendo o legado. A abertura explícita pela URL ou pelo botão confirmado inicia o banco principal vazio, sem copiar outras chaves. A troca padrão depende de autorização posterior.
- Banco `raytech_cg_v2_main_finance_v1`; marcador `raytech_cg_v2_main_initialized_v1`; metadados prefixados por `raytech_cg_v2_main_sync_v1:`; Web Lock `raytech-cg-v2-main-workspace`; lock de sincronização na namespace main_.
- Backup principal JSON e aba integral Excel usam envelope `raytech-cg-v2-main-backup-v1`. Rejeitam backups crus do legado/teste e importação Excel genérica nesta fase. O envelope diferencia origem operacional, não autentica arquivos contra adulteração deliberada. Exportação e restauração integral continuam disponíveis.
- Flag `syncEnabled:false` preservada. Painel e adaptador exigem modo principal para qualquer futura transferência. Nenhuma escrita real, migração, merge ou publicação.
- A falta do banco após marcador ou checkpoint exige recuperação explícita, não recriação silenciosa. Uma escrita interrompida no primeiro acesso pode exigir recuperação manual. Não limpar dados do navegador.

## Resiliência final (candidato)
- Recuperação emergencial somente no V2 principal, sob lock principal, confirmação, PIN existente e envelope JSON estrito. Preserva os bytes anteriores em quarentena local de uma posição (não sobrescreve cópia distinta), recusa checkpoint vinculado, valida snapshot esperado. Falha de armazenamento não autoriza apagar dados. Em caso de segunda quarentena distinta ou checkpoint, atendimento manual será necessário.
- XLSX real 0.18.5 (mesma versão do aplicativo) no teste de exportação/restauração integral e rejeição do formato de outro banco. Dependência somente de testes; versão legada não deve ser considerada segura para arquivos não confiáveis.
- Service Worker ativo em Chromium localhost com espelhos locais de CDN (Tailwind/Chart simulados, XLSX real) e lógica de cache original. Não equivale a teste de instalação nativa no dispositivo do usuário.
- Capacidade: 180000 caracteres JS (unidades UTF-16; não equivalem a bytes UTF-8), 24 meses, 200 por lista/mês, 500 marcas, 120 parcelas, valores até 10000000. Firestore valida payload de 180000; tamanho de documento inclui envelope/overhead. Limites não ampliados. Painel do principal indica ocupação e alerta a partir de 80% de qualquer limite monitorado; bloqueio mantém banco anterior. Arquivamento histórico e expansão são projetos separados.
- Consumo Spark: limite local do código de 300 tentativas por UID/dia UTC/dispositivo, não quota global nem garantia de gratuidade. Cada operação nova grava head e recibo; tentativas/repetições podem demandar leituras/transactions. Sincronização segue desativada, nenhum teste de carga em produção.
