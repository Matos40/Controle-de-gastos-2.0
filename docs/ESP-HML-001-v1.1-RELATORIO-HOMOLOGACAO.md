# ESP-HML-001 v1.1 — Relatório consolidado de homologação experimental

**Data de referência:** 14/11/2026 (America/Bahia, UTC−03:00).  
**Escopo:** GATE-01, GATE-02, GATE-03 e ROLLBACK-01; documentação retrospectiva, sem ativação de sincronização financeira.  
**Parecer:** GATE-01 aprovado; GATE-02 aprovado no escopo de preparação; GATE-03 aprovado nos cenários físicos executados, com limitações de cobertura expressas abaixo; ROLLBACK-01 aprovado como desativação e republicação do mesmo conteúdo. Não constitui aprovação para integração ou produção.

## 1. Identidade e rastreabilidade

- Repositório: [Matos40/Controle-de-gastos-2.0](https://github.com/Matos40/Controle-de-gastos-2.0).
- [PR #7](https://github.com/Matos40/Controle-de-gastos-2.0/pull/7), aberto, sem merge na reconferência anterior ao commit documental.
- Branch exclusiva: `feature/financial-repository-v11-foundation`.
- Especificação [ESP-HML-001 v1.1](ESP-HML-001-v1.1.md): reconstrução aprovada, não reprodução literal da v1.0.
- Base da implementação: `8a9b2958e7f87e73b771df179ae790412d9d1ff6`.
- Implementação experimental: `f84145ba590ec33186c4d470c2715c49c53d14a8`; correção do teste T28 e HEAD certificado: [27c4cc13d50968008fc9787f1cb3bea58c5f2a3e](https://github.com/Matos40/Controle-de-gastos-2.0/commit/27c4cc13d50968008fc9787f1cb3bea58c5f2a3e).
- Main reconferida antes deste registro: `38012bc94d1946ca13f6dba576e3ef30858e97e3`.
- O relatório não altera a especificação, código, testes, configuração de workflows ou Firebase. Os resultados de CI de um futuro commit documental devem ser verificados separadamente; não se atribui antecipadamente sua aprovação.

## 2. GATE-01 — Certificação automatizada

Baseline: 369 regressões + 17 fila/guardião + 8 emuladores + 5 navegador = 399. Acréscimo dos 32 casos T01–T32 da especificação, total de 431. A primeira implementação teve 430/431; correção restrita à asserção T28 (reconhecimento de optional chaining em configuração) no HEAD certificado. Reconferência dos logs e jobs originais pelo conector GitHub na consolidação:

| Grupo | Aprovados | Evidência |
|---|---:|---|
| Regressões | 369/369 | [Run 43558088818](https://github.com/Matos40/Controle-de-gastos-2.0/actions/runs/43558088818), job 132335401007 |
| Fila/guardião | 17/17 | [Run 43558088824](https://github.com/Matos40/Controle-de-gastos-2.0/actions/runs/43558088824), job 132335401143 |
| Auth/Functions/Firestore emulados | 8/8 | mesmo job experimental |
| Navegador Chromium/IndexedDB | 5/5 | mesmo job experimental |
| HML T01–T32 | 32/32 | mesmo job; TAP e checksum retidos |
| Total | **431/431** | ambos workflows concluídos com sucesso |

Nenhuma falha ou teste omitido nos resultados certificados; emuladores não representam implantação de Functions ou Firestore real. Os workflows retiveram artefatos sem publicação automática.

### Artefato certificado e cadeia de integridade

[Artefato Actions 14098929231](https://github.com/Matos40/Controle-de-gastos-2.0/actions/runs/43558088824/artifacts/14098929231), nome `raytech-cg-hml-001-v1.1`, 37.021 bytes, digest retornado pela API GitHub. Expiração informada: 21/11/2026 04:45:58 UTC; o link poderá expirar. Preservar a cópia original local e os relatórios, não regenerar um ZIP e atribuir-lhe o mesmo hash.

| Objeto | SHA-256 |
|---|---|
| ZIP externo Actions | `1ee6ad9cfdd410014063ebbbabe0bf009a94c7a0edf41111bd0a8b7f161cd38f` |
| ZIP interno raytech-cg-hml-001-v1.1.zip | `b3e403cbc7911783d06a10b920801a5e24634a768a8b452d490ca362c15465f0` |
| staging.html (1.033 bytes) | `57b4746492bc40c8264da7db55ff8a98dbeab846cbc1eacab3e7f4a44e5740d7` |
| assets/staging-DwcEAbnp.js (108.511 bytes) | `6e1da8f7b7b51e26efa21082f50dc356d9b357c178fef95d83af13eb5df8102a` |

Evidências do pacote: manifesto, checksum, validation-report.json e hml-tests.tap. Os hashes externo e interno foram recalculados no computador do operador e coincidiram com os valores certificados; os dois arquivos individuais foram validados localmente, após primeira publicação e após recuperação. Hashes demonstram igualdade de bytes em relação à referência confiável, não uma assinatura digital.

## 3. GATE-02 — Ambiente e preparação

- Projeto/site ID: `raytech-cg-homologacao`; número `195471491370`; App ID público `1:195471491370:web:b7e5a0a5a218d16f7a9e53`.
- Origem e caminho exclusivos: `https://raytech-cg-homologacao.firebaseapp.com/staging.html`, sem query/fragmento. Domínio autorizado e provedor Google habilitado, conforme capturas do console.
- Spark confirmado; faturamento desativado em consultas gcloud antes do deploy e pós-rollback.
- CLI Firebase 15.35.0, Node 22.18.0, npm 11.13.0, Google Cloud SDK 541.0.0, Windows PowerShell. Autenticações CLI renovadas após 401/invalid_grant. Consulta REST corrigida adicionando X-Goog-User-Project apontando apenas à homologação; não houve ampliação de permissões nem mudança de cobrança relatada. Antes da primeira publicação, endpoints releases e versions retornaram HTTP 200 com objeto vazio; domínio exibiu Site Not Found. Site DEFAULT_SITE e canal live já existiam.
- Diretório local independente Raytech-CG-HML-001: evidencias, laboratorio, public. Somente os dois arquivos estáticos (109.544 bytes) em public. Manifesto, ZIPs, TAP e relatórios permaneceram fora da pasta pública.
- firebase.json exclusivamente hosting, target homologacao, public, cleanUrls false, ignore; .firebaserc associa exclusivamente o target ao site correto. Auditoria local 12/12 e pré-deploy 13/13 aprovados pelos scripts e saídas do operador. Nenhuma implantação até autorização específica posterior.
- Contingência definida como desativação do Hosting e recuperação através dos arquivos certificados, dado que não havia versão anterior à primeira publicação.

## 4. GATE-03 — Publicação e homologação física

Primeira publicação manual autorizada, exclusiva de Hosting, com `firebase deploy --only hosting:homologacao --project raytech-cg-homologacao`. CLI confirmou dois arquivos e sucesso. Versão `d707bc02612065b7`, release `1794634857849000`, tipo DEPLOY, 2026-11-14T05:40:57.849Z. Os dois GETs retornaram HTTP 200 e hashes idênticos à seção 2.

### Evidências físicas

Fonte: capturas e saídas fornecidas pelo operador na conversa de homologação em 14/11/2026; não são logs instrumentados independentemente. Números exatos das versões dos sistemas/navegadores não foram coletados. Nenhuma imagem com contas, e-mail, UID, token ou chave é incorporada neste commit. A matriz documenta testes conduzidos com contas de teste A/B e operações fictícias; as imagens evidenciam o estado final, e a sequência de ações é baseada no procedimento orientado e relatado.

| Cenário principal | Windows Chrome | Android Chrome | iOS Chrome |
|---|---|---|---|
| 01 — Inicialização, consentimento, controles desabilitados | Aprovado | Aprovado | Aprovado após reteste IOS-06 |
| 02 — Google Auth e fila inicial | Aprovado | Aprovado | Aprovado |
| 03 — Criação e consulta fictícia IndexedDB | Aprovado | Aprovado | Aprovado |
| 04 — Persistência após sair/reautenticar | Aprovado após recarga; fechamento normal em WIN-06 | Aprovado após fechamento/reabertura relatados | Aprovado após fechamento/reabertura relatados |
| 05 — Separação funcional A/B/A | Aprovado | Aprovado | Aprovado |

Total: 15/15 cenários principais executados com resultado esperado; 2/2 complementares IOS-06 (consentimento inicial desmarcado em nova aba) e WIN-06 (persistência após fechamento e reabertura em perfil normal). A primeira execução Windows em janela anônima validou recarga/relogin, não fechamento completo. Em WIN-06 havia fila preexistente no perfil normal; origem temporal da operação não identificada; não se criou nova operação durante a checagem de persistência. O teste verifica existência da fila, não identidade criptográfica do registro individual. Não foram confirmadas falhas funcionais nos cenários concluídos.

Evidências adicionais:
- Windows: o link inicialmente acrescentou `?utm_source=chatgpt.com`; o guardião recusou a origem/caminho, conforme previsto. Após navegação limpa e uso de janela anônima, status Desativado, consentimento/chave habilitaram login, autenticação concluída. Nenhuma mudança de código ou novo deploy para resolver o incidente. O teste mostra recusa de query, não comprova todos os bloqueios de origem em dispositivos físicos.
- Android e iOS: primeira consulta no dispositivo exibiu fila vazia apesar de fila existente no Windows, consistente com armazenamento local. Sequência A existente → B vazia → A existente demonstrada em cada plataforma.
- Mensagens de transporte financeiro bloqueado e sincronização indisponível foram exibidas durante os testes. A ausência de tráfego financeiro não foi confirmada por captura independente de rede; a arquitetura e os testes automatizados sustentam o bloqueio.
- Google Auth utiliza persistência de sessão em memória; IndexedDB experimental segregado por projeto/UID. Uma fila por conta; não há sincronização financeira remota. Não implica criptografia ou controle de acesso a dados locais contra acesso direto ao navegador.

### Cotas e custo

Capturas do console de 14/11/2026: plano Spark, sem custos financeiros; armazenamento Hosting 34,04 KB no painel específico (painel geral 0 B), downloads 319 KB; cotas mostradas 10 GB armazenamento total, 10 GB/mês downloads. Métricas estimadas, atualizadas a cada 24 horas; discrepância entre painéis registrada, não reconciliada artificialmente. Firestore exibiu zero leituras, gravações e exclusões na janela diária consultada; não implica ausência histórica de operações nem auditoria completa de rede. Último valor registrado de custo R$0,00, não garantia futura. Faturamento reconfirmado desativado após recuperação.

## 5. ROLLBACK-01 — Desativação e recuperação

Autorização específica posterior à homologação. Pré-check 9/9; projeto, target, configuração exclusiva, dois arquivos, SHA-256 individual, ZIP externo, faturamento e versão ativa confirmados. Evidência local `rollback-01/pre-rollback-20261114-141237.json` (data UTC 2026-11-14T17:12:37.7915551Z).

| Etapa | Resultado |
|---|---|
| Versão original | d707bc02612065b7 / release 1794634857849000 |
| Desativação | firebase hosting:disable --site raytech-cg-homologacao --project raytech-cg-homologacao; CLI confirmou desativação |
| Indisponibilidade | HTTP 404 em staging.html e assets/staging-DwcEAbnp.js |
| Recuperação | Mesmo comando de deploy restrito ao Hosting, 2 arquivos, sucesso |
| Integridade | HTTP 200 nos dois arquivos e SHA-256 exatamente igual à seção 2 |
| Versão recuperada | 99ac976d2c2f8b42 / release 1794676556901000, tipo DEPLOY, 2026-11-14T17:15:56.901Z |
| Faturamento | false na consulta posterior |
| Teste funcional | Windows Chrome normal, conta A autenticada, fila fictícia existente sem nova operação relatada, transporte financeiro bloqueado |

Evidência local `rollback-01/pos-rollback.json`, data UTC 2026-11-14T17:18:04.9998354Z. Captura funcional posterior às 17:19 UTC aproximadamente. A versão recuperada foi a última registrada, não uma garantia do estado futuro.

Parecer: **aprovado** para retirada de disponibilidade e republicação do conteúdo idêntico. Não foi um rollback nativo para a mesma versão/release: a recuperação criou nova versão. Não comprova recuperação de banco financeiro, restauração de backups ou revogação de cópias previamente cacheadas. Não foram executados comandos de exclusão de usuários, banco, dados do navegador ou mudança de cobrança durante o teste. O escopo dos comandos foi exclusivamente Hosting, embora não tenha havido auditoria independente de todos os demais recursos.

## 6. Limitações, desvios e condições de avanço

1. O roteiro original prevê iOS Safari 16.4+ e PC Chrome/Edge 111+; foi utilizado Chrome no iOS por escolha do operador. Safari, Edge e versões mínimas não foram comprovados. Não confundir cobertura dos 15 cenários escolhidos com execução de todo o roteiro original.
2. Cancelamento/falha de login, consulta offline seguida de reconexão, indisponibilidade/aborto de IndexedDB e todos os bloqueios de origem/caminho em dispositivos físicos não tiveram evidência física específica registrada; parte desses casos possui cobertura automatizada na especificação. Navegação privada foi utilizada no Windows, não homologada nas três plataformas. A homologação física integral segundo todas as condições do roteiro original não pode ser declarada.
3. Hosting público; consentimento e guardião no cliente não equivalem a allowlist ou autorização no servidor. Somente contas de teste e dados sintéticos. O isolamento demonstrado é funcional, não criptográfico. Nenhum dado financeiro real, backup, PIN ou chave Gemini deve ser utilizado.
4. Backend confiável, autorização server-side, validação de tokens, recibos/idempotência, conflitos, limites, App Check e políticas de segurança financeira remota exigem especificação, implementação e testes independentes. Transporte financeiro permanece bloqueado.
5. Evidências de campo são fornecidas pelo operador; sem acesso independente ao terminal e dispositivos. Os registros locais e capturas não são anexados ao repositório por este commit; preservá-los localmente, com dados sensíveis omitidos. Logs e artefatos GitHub sujeitos à retenção.
6. Nenhuma autorização para merge, mudança na main, publicação da aplicação oficial, alteração de regras, Cloud Functions/Cloud Run, uso de Firestore remoto, plano Blaze ou migração financeira. Manter o laboratório apenas no escopo experimental. Qualquer avanço exige aprovação separada e reconferência do ambiente.

## 7. Parecer final

Os 431 testes certificados, os 15 cenários físicos principais, os dois complementares, os controles de integridade e a contingência documentada sustentam aprovação **limitada ao laboratório e às condições efetivamente verificadas**. GATE-03 registrado como concluído no escopo físico executado, com lacunas explícitas em relação ao roteiro original. Não é certificação de produção, de segurança integral nem de sincronização financeira. ROLLBACK-01 aprovado no escopo de Hosting. Este registro consolida as autorizações separadas e não altera o estado do aplicativo oficial.
