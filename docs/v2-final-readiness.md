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
