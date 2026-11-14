# Pacote documental consolidado: homologacao FinancialRepository v1.1

**PR:** #7  
**Branch:** feature/financial-repository-v11-foundation  
**Tipo:** indice, checklist e gates de autorizacao. Nao e ordem de execucao.  
**Baseline de CI confirmada anteriormente:** #405, commit f1eeeca, 150/150 testes aprovados. O CI de 8c07dc5 e deste documento exige confirmacao separada.

## Documentos integrantes
1. `financial-repository-v11-experimental-closure.md`: escopo experimental e limites comprovados.
2. `financial-repository-v11-final-isolation-audit.md`: riscos, isolamento e lacunas.
3. `financial-repository-v11-backup-compatibility-matrix.md`: formatos suportados apenas em planejamento e lacunas.
4. `financial-repository-v11-real-backup-homologation-plan.md`: fixtures anonimizadas, criterios de aceite e rollback.
5. `financial-repository-v11-homologation-evidence-templates.md`: registros e decisoes por fixture.

## Checklist de prontidao documental
- [x] Baseline de testes automatizados identificado com run e commit.
- [x] Regras de preservacao de origem e isolamento descritas.
- [x] Matriz JSON simples, selado, invalido e Excel documentada.
- [x] Modelo de evidencia por fixture e invariante documentado.
- [x] Procedimento para rollback bloqueado e confirmacao de exclusao descrito.
- [x] Critérios de aprovado, reprovado, bloqueado e nao aplicavel definidos.
- [x] Limites de integridade, quota, dispositivo e historico explicitados.
- [ ] CI do ultimo commit documental confirmado.
- [ ] Autorizacao especifica para uso de copias anonimizadas.
- [ ] Copias anonimizadas preparadas e revisadas pelo titular.
- [ ] Execucao da homologacao real em ambiente separado.
- [ ] Relatorio de evidencias preenchido e aprovado.
- [ ] Autorizacao independente para qualquer implementacao/integracao.

## Gates de autorizacao independentes
**G0 - Documentacao:** permitida somente alteracao de documentos na branch do PR. Nao autoriza acesso a dados.

**G1 - Fixtures:** exige consentimento expresso do titular para uso de copias anonimizadas, revisao de privacidade e confirmacao de que arquivos nao serao enviados ao repositorio nem registrados em logs. Sem consentimento: BLOQUEADO.

**G2 - Homologacao isolada:** exige aprovacao explicita do escopo de testes e ambiente. Pode avaliar fixtures autorizadas sem tocar na producao. Cada caso deve registrar resultados e invariantes.

**G3 - Proposta de integracao:** somente apos evidencias completas, CI verde e revisao de rollback. Exige autorizacao especifica; nao e consequencia automatica de G2.

**G4 - Merge / Firebase / publicacao:** cada acao exige autorizacao especifica separada. Nenhuma e implicita em G0-G3.

## Criterios de aceite da futura homologacao
- Origem preservada; nenhuma escrita parcial ou alteracao nao autorizada.
- Campos financeiros, meses, parcelas, exclusoes, categorias e metadados preservados com semantica e digest coerentes.
- Totais e saldos reconciliados sem divergencia.
- Reimportacao idempotente e duplicidades legitimas preservadas.
- Entrada invalida ou adulterada rejeitada antes da escrita.
- IndexedDB isolado verificado apos reabertura; rollback bloqueado nunca declarado concluido.
- Evidencias anonimizadas auditaveis e CI associado ao commit testado.
- Qualquer falha critica, fixture ausente ou consentimento pendente bloqueia progressao.

## Decisao nesta etapa
**G0 preparado. G1-G4 NAO AUTORIZADOS.** Nao acessar backups reais, implementar importacao XLSX, ativar Firebase, integrar aplicativo, alterar main, fazer merge ou publicar. O PR permanece experimental.
