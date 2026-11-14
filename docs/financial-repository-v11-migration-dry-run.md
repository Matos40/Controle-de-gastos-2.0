# FinancialRepository v1.1: plano de migracao reversivel (NAO ATIVADO)

Status: proposta isolada no PR #7. Nenhuma migracao automatica, troca de fonte principal ou alteracao de localStorage foi autorizada.

## Fonte de verdade e compatibilidade
- Origem: chave `controle_gastos_multimonth_v3` no localStorage. Manter bytes originais inalterados.
- Destino experimental: banco IndexedDB `raytech-financial-repository-v11-isolated`.
- A importacao deve preservar todas as propriedades financeiras desconhecidas, meses, despesas, parcelas, tombstones e rendas extras.
- O plano `planMigration` e somente leitura e retorna uma copia selada, checksum e instrucoes; nao faz gravacoes.

## Protocolo futuro (nao implementado)
1. Com consentimento expresso, exportar e verificar um backup JSON completo em armazenamento independente.
2. Congelar gravacoes na origem durante a captura ou usar protocolo de versao para detectar mudancas simultaneas.
3. Validar o backup, gerar checksum canonico SHA-256 e copiar para um banco de homologacao isolado.
4. Reabrir o IndexedDB, validar todos os meses, totais, parcelas, recibos e comparar checksum com a copia original.
5. Executar testes em navegadores reais, incluindo mobile e Safari, com falhas de energia, quota e abas concorrentes.
6. Somente apos aprovacao humana explicita considerar uma chave de ativacao separada e reversivel. Nunca apagar o localStorage legado na ativacao.
7. Rollback: desativar leitura da nova base e voltar a origem preservada. Nao substituir silenciosamente a origem com dados divergentes.

## Riscos e bloqueios atuais
- O checksum SHA-256 detecta divergencia acidental, nao e assinatura autenticada nem protege contra adulteracao maliciosa coordenada.
- Os envelopes do adaptador IndexedDB ainda nao sao selados/verificados automaticamente em cada leitura e escrita.
- A implementacao atual de recibos armazena copias completas do banco por operacao; e necessario limitar crescimento sem perder idempotencia.
- A selecao de mes e local por dispositivo precisa de separacao arquitetural antes da ativacao.
- O nucleo de comandos e o fluxo de backup/Excel legado ainda precisam de equivalencia funcional completa.
- Nao existe teste de recuperacao real de corrupcao fisica de disco ou interrupcao abrupta do processo.

## Condicao de seguranca
Qualquer erro de validacao, checksum, conflito, falta de espaco ou incerteza deve impedir ativacao e preservar a origem. Recuperacao por backup exige aprovacao explicita; nunca substituir dados automaticamente.
