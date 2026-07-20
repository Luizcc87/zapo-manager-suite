# Pareamento por Passkey e Protocolo Shortcake (docs/PASSKEY-LINKING.md)

Este documento descreve o funcionamento do pareamento por Passkey (WebAuthn) e o protocolo **Shortcake / CRSC** (*Companion Registration over Side Channel*), conforme documentado oficialmente na engenharia reversa do projeto Zapo.

---

## 1. O que é o Shortcake / CRSC?

O WhatsApp adota um fluxo de pareamento protegido por passkey para contas sinalizadas com restrições ou selecionadas em testes A/B no servidor.
* **Shortcake**: Nome do fluxo no lado Web (companion).
* **CRSC**: Companion Registration over Side Channel, nome do fluxo no celular (primary).

Em contas onde esse fluxo está ativo (parâmetro de servidor `29205=true`), o WhatsApp **recusa** o pareamento tradicional por QR Code ou Código de Pareamento de 8 dígitos convencional e exige uma asserção WebAuthn Passkey válida gerada pelo dispositivo do proprietário.

> [!WARNING]
> **Não existe bypass headless.** Para contas onde o pareamento por Passkey é exigido pelo servidor, é tecnicamente impossível simular ou falsificar a assinatura da asserção Passkey (`webauthn_assertion`), pois a chave privada reside no hardware do celular do usuário e a assinatura é validada ponta a ponta pelos servidores do WhatsApp contra o desafio enviado no handshake.

---

## 2. Fluxo de Troca de Stanzas (Passkey vs QR Code)

A sequência de mensagens XML (stanzas) durante o pareamento Shortcake ocorre da seguinte forma no Companion (Web):

| Ordem | Direção | Stanza / Evento | Descrição |
|-------|---------|-----------------|-----------|
| 1 | ◄ Recv | `notification` (`passkey_prologue_request`) | O servidor avisa que a conta exige Passkey e envia as opções de desafio. |
| 2 | ► Send | `ack` | Confirmação de recebimento do prologue. |
| 3 | ► Send | IQ `GetPasskeyRequestOptions` | Solicita detalhes das credenciais WebAuthn (se não vieram embutidos). |
| 4 | ► Send | IQ `GetRef` | Obtém o `ref` da sessão de pareamento. |
| 5 | ► Send | IQ `SetPasskeyPrologue` | Envia a asserção Passkey (`webauthn_assertion`), id da credencial e payload do prologue. |
| 6 | ◄ Recv | `notification` (`primary_ephemeral_identity`) | O celular envia sua identidade efêmera e nonce. |
| 7 | ► Send | IQ `SetCompanionNonce` | Revela o nonce gerado pelo companion. |
| 8 | ► Send | IQ `SetEncryptedPairingRequest` | Envia a requisição criptografada (AES-GCM) contendo os segredos de pareamento. |
| 9 | ◄ Recv | Registro concluído | A sessão é autenticada e vinculada via chaves ADV. |

---

## 3. Implicações para o Zapo-Manager

1. **Tentativas de Pareamento em Contas Gated**:
   Se uma instância tentar se conectar e receber a notificação `passkey_prologue_request` do servidor, o cliente de automação precisará capturar o desafio e repassá-lo para que o navegador do usuário faça a requisição de credenciais locais.
2. **Detecção de Erros Silenciosos**:
   Asserções falsas ou forjadas são rejeitadas silenciosamente pelo servidor do WhatsApp (ele simplesmente para de responder os pacotes subsequentes, gerando timeout da conexão no manager).
3. **Resolução de Conectividade**:
   O fluxo de pareamento por código convencional de 8 dígitos ainda funciona normalmente para contas onde a restrição de Passkey não foi ativada.
