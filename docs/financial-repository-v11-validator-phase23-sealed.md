# Etapa 2.3 — verificador sintetico JSON selado v1

Escopo: testes isolados, somente strings JSON inventadas em memoria. Sem abertura de arquivos, rede, armazenamento, importacao, anonimizacao, migracao ou integracao com o aplicativo.

Arquivos: `tests/fixtures/financialRepositoryV11ValidatorPhase23Sealed.cjs` e `tests/financialRepositoryV11ValidatorPhase23Sealed.test.cjs`.

O verificador aplica limites de 128 KiB, 32 niveis e 10000 nos, valida envelope `schemaVersion:1`, `algorithm:'SHA-256'`, digest hexadecimal de 64 caracteres, estrutura financeira legada e compara digest canonico usando `FinancialRepositoryV11Integrity.verify` existente. Nao reescreve nem corrige digests. Chaves perigosas bloqueiam. Campos desconhecidos no nivel do envelope exigem REVIEW depois de verificacao valida. Falhas retornam codigos sem dados de entrada.

**Limites:** digest nao autentica origem. Campos desconhecidos aninhados nao recebem classificacao de privacidade nesta etapa; ausencia de scanner de dados pessoais significa que PASS nao prova anonimato. JSON.parse nao detecta chaves duplicadas antes de consolida-las. O modulo continua exclusivamente na pasta de testes, sem vinculacao ao aplicativo.

14 testes sinteticos, incluindo os dez cenarios planejados, mais truncamento, limite de bytes, chave perigosa e demonstracao de que re-selar conteudo diferente tambem passa no SHA-256. Aprovacao depende de logs reais do CI no commit final. Main, Firebase e producao fora do escopo.
