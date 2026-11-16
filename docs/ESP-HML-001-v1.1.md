# ESP-HML-001 v1.1 — Raytech CG
Reconstrução aprovada em 14/11/2026; não é reprodução literal da v1.0 perdida. PR #7, branch feature/financial-repository-v11-foundation, base 8a9b2958e7f87e73b771df179ae790412d9d1ff6. Evidências: experimental/firebase/PHYSICAL-STAGING.md, STAGING-RECOVERY.md, STAGING.md, staging-guard.mjs, package.json, verify-staging-build.mjs. Baseline verificada nos logs dos runs 43554096650 e 43554096616: 369 regressões + 17 fila/guardião + 8 emuladores + 5 navegador = 399. Meta: 431.
## 20 requisitos
- HML-01: Branch experimental e PR #7 somente
- HML-02: Origem HTTPS exclusiva https://raytech-cg-homologacao.firebaseapp.com
- HML-03: Caminho /staging.html sem query ou fragmento
- HML-04: Projeto raytech-cg-homologacao somente
- HML-05: Plano Spark, sem cobrança ou serviços pagos
- HML-06: Consentimento antes do login
- HML-07: Configuração pública fornecida localmente, sem chave incorporada ou persistida pelo aplicativo
- HML-08: Google Auth com persistência em memória
- HML-09: Invalidar operações assíncronas de sessões encerradas
- HML-10: Logout sem apagar fila
- HML-11: IndexedDB experimental segregado por projeto e UID
- HML-12: Recuperar fila sintética após recarga e nova autenticação
- HML-13: Isolar filas de usuários distintos
- HML-14: Comunicar falhas de persistência, sem sucesso falso ou fallback legado
- HML-15: Transporte financeiro bloqueado inclusive após reconexão
- HML-16: Build independente sem integração com aplicação principal
- HML-17: Preservar 399 casos anteriores e adicionar exatamente 32
- HML-18: Artefato isolado com manifesto e SHA-256 verificável
- HML-19: Homologação física posterior PC/Android/iOS, sem dados pessoais
- HML-20: Gates independentes e rollback não destrutivo, sem publicação automática
## 32 cenários automatizados
- T01: Origem/caminho exatos
- T02: HTTP bloqueado
- T03: GitHub Pages antigo bloqueado
- T04: Produção bloqueada
- T05: web.app bloqueado
- T06: Caminho divergente bloqueado
- T07: Query e fragmento bloqueados
- T08: Projeto divergente rejeitado
- T09: Login inicial desabilitado
- T10: Consentimento ausente/revogado impede login
- T11: Configuração incompleta rejeitada
- T12: Configuração válida sem persistência da chave
- T13: Autenticação com sessão em memória
- T14: Falha/cancelamento permanece desconectado
- T15: Logout invalida operações assíncronas
- T16: Relogin mesmo UID invalida ticket antigo
- T17: Fila persistente após reabertura
- T18: Conta B não vê fila A
- T19: Retorno A recupera fila
- T20: Namespaces por projeto
- T21: IndexedDB indisponível sem fallback
- T22: Transação abortada sem sucesso falso
- T23: Transporte retorna TRUSTED_BACKEND_UNAVAILABLE
- T24: Reconexão preserva fila sem envio
- T25: Build isolado
- T26: Assets relativos e existentes
- T27: Sem integração financeira remota/legada
- T28: Sem credenciais ou configuração de produção
- T29: Manifesto corresponde aos arquivos/hash
- T30: SHA-256 íntegro aprovado e adulterado rejeitado
- T31: Workflow sem publicação/cobrança
- T32: Escopo protegido e regressões preservadas
Cada T corresponde a um teste executável. Variantes internas não alteram contagem. Os casos ST01 e Q09 mantêm sua finalidade, atualizando exclusivamente a fixture da origem/caminho aprovados; os 17 testes de fila/guardião permanecem.
## Fases e gates
Fase 1: proposta aprovada. Fases 2/3: implementação experimental, testes, commit, CI, artefato e conferência independente. GATE-01 exige 431 aprovações, workflows verdes, diff restrito, manifesto, hash e nenhum deploy. GATE-02 exige GATE-01, verificação console Firebase, plano Spark/cotas, domínio/Auth e autorização separada para disponibilização (Fase 4). GATE-03 exige GATE-02 e homologação física (Fase 5), evidências sem UID/email/token e resolução de incidentes. Nenhuma publicação ou integração financeira foi autorizada.
## Artefato
raytech-cg-hml-001-v1.1.zip contém staging.html, assets e manifest.json (versão, commit, projeto, origem, caminho, tamanhos e hashes). SHA-256 externo .zip.sha256 e validation-report.json vinculam resultado à execução CI. Recalcular hash dos bytes baixados e comparar com checksum confiável, sem circularidade. Hash sozinho não prova autenticidade.
## Homologação física posterior
PC Chrome/Edge 111+, Android Chrome 111+, iOS Safari 16.4+. Registrar SO/navegador/data/resultado, não email/UID/token. Consentimento/login, cancelamento, criação fictícia, recarga/recuperação, troca A/B, logout/relogin, offline/reconexão, navegação privada se suportada, isolamento entre dispositivos. A fila é local, não deve aparecer remotamente. Login offline não é esperado. Nenhum dado financeiro, PIN, chave Gemini ou backup real.
## Proteções e rollback
HEAD divergente: parar; regressão: corrigir dentro do escopo ou reverter commit; hash divergente: rejeitar artefato; build falho: bloquear gate; falha Auth/IDB: comunicar e preservar fila; problema após futura publicação: restaurar versão verificada somente mediante autorização. Sem force push, exclusão automática de dados, limpeza indiscriminada, exclusão de contas/projetos, merge, deploy, alterações main/produção/Firebase/cobrança. Sem Firestore remoto, Functions, Cloud Run, Blaze. Meta de custo adicional R$0, não garantia: console e cotas ainda não confirmados. Núcleo financeiro, IndexedDB financeiro, aplicação principal, SW, regras e workflows de publicação protegidos.
