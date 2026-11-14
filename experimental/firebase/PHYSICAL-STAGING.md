# Homologação física v1.1 — autenticação e fila local
Base: 6c10b63, 391 testes aprovados. Projeto existente raytech-cg-homologacao; identidade conferida no arquivo js/services/firebaseAuth.js do repositório de homologação. Sem alteração de regras, cobrança, deploy ou dados remotos financeiros.
A página staging.html é um ponto de entrada separado, bloqueado fora do caminho HTTPS exato de homologação. Precisa de build Vite e publicação futura expressamente autorizada; não está disponível agora. A chave pública deve ser fornecida manualmente, sem persistência no aplicativo. Auth usa memória; após recarga, autenticar novamente. A fila fictícia é segregada por projeto e UID. Transporte financeiro sempre retorna indisponível; não usa Firestore nem Functions. A fila não tem descarte automático.
## Roteiro físico (após disponibilização autorizada)
Para cada PC (Chrome/Edge), Android (Chrome) e iOS (Safari): registrar versão do SO/navegador, data e resultado, sem capturar e-mail, UID ou token.
1. Abrir caminho de homologação e confirmar que login está inicialmente desabilitado. Aceitar consentimento, fornecer configuração pública e entrar com conta de teste A.
2. Criar operação fictícia; consultar fila. Recarregar, autenticar A novamente e verificar fila existente.
3. Sair, autenticar conta B; verificar fila vazia. Retornar a A e verificar fila original.
4. Com sessão A ativa, desligar rede e consultar fila. Religar rede; confirmar que nenhuma sincronização financeira ocorreu. Login offline não é esperado.
5. Repetir em navegador privado quando suportado; indisponibilidade IndexedDB deve ser registrada como bloqueio, sem promessa de persistência.
6. No segundo dispositivo, autenticar A; verificar identidade funcional. Fila é local e não deve aparecer remotamente. Sincronização entre dispositivos está fora deste ensaio.
7. Verificar que a página no caminho de produção ou origem diferente não permite login.
## Bloqueios
Verificar no console o plano Spark, autorização Google e domínio antes de teste. Não conceder permissões Firestore nem ativar Functions. Sincronização financeira real exige backend confiável, validação de token, autorização, recibos, limites, revisão e testes de segurança; nenhum transporte direto pelo cliente será aceito. Nenhum dado real, PIN, chave Gemini ou backup deve ser usado.

## Build isolado (sem publicação)
Executar npm install e npm run build:staging em experimental/firebase. A saída dist-staging contém apenas staging.html e assets relativos. O CI verifica a estrutura e guarda o pacote como artefato privado da execução, sem publicar Pages. Suporte alvo: Chrome/Edge 111+, Safari 16.4+. O guardião continua bloqueando o login fora do caminho autorizado. A entrega física depende de autorização posterior de publicação e verificação do console Firebase.
