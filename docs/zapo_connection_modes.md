# Guia de Modos de Conexão WhatsApp no Zapo

Este documento apresenta uma visão detalhada dos modos de conexão suportados pelo **Zapo**, explicando como o protocolo de rede e a simulação de dispositivos afetam a estabilidade, o uso do aplicativo oficial no celular e as taxas de banimento.

---

## 📖 Glossário de Termos Técnicos (Para Leigos)

Para facilitar a leitura, aqui estão explicações simples de termos comuns utilizados neste guia:

* **Companion (Aparelho Vinculado):** É o modo clássico de usar o WhatsApp em mais de um lugar. O seu celular físico continua sendo o "dono" da conta, e você conecta outros dispositivos (como computador, tablet ou a nossa API) lendo um QR Code.
* **Primário (Aparelho Principal):** É o aparelho principal onde o WhatsApp foi registrado (onde você coloca o chip e recebe o SMS de confirmação). Só existe um aparelho Primário por número de telefone.
* **WebSocket (Conexão via Navegador):** Tecnologia de rede que navegadores de internet (Chrome, Safari) usam para receber e enviar dados em tempo real. É o formato usado pelo WhatsApp Web.
* **TCP Socket Bruto (Conexão Direta de Aplicativo):** Uma conexão de rede direta e sem intermediários, exatamente igual à que o aplicativo oficial do WhatsApp no celular usa. Não depende de simular um navegador de internet.
* **OTP (One-Time Password / Código SMS de Confirmação):** O código de segurança de 6 dígitos enviado por SMS para o seu chip quando você ativa o WhatsApp em um celular.
* **Takeover (Substituição de Sessão):** O ato de um aparelho novo "tomar" a conexão e desconectar o aparelho anterior (como quando você loga no celular novo e desloga do antigo).
* **Swarm Safety (Prevenção de Dupla Conexão):** Regras de segurança no servidor para evitar que duas cópias do sistema rodem o mesmo número ao mesmo tempo, prevenindo o banimento imediato pelo WhatsApp.
* **Lock (Tranca de Segurança):** Um bloqueio virtual que impede que a mesma conta seja aberta em dois lugares ao mesmo tempo dentro do nosso servidor.

---

## 🔌 Tabela Comparativa de Modos

| Característica | WhatsApp Web (Companion / Vinculado) | Zapo Mobile (Companion / Vinculado) | Zapo Mobile (Primário / Principal) |
| :--- | :--- | :--- | :--- |
| **Tipo de Conexão** | WebSocket (Conexão de Navegador) | TCP (Conexão Direta de Aplicativo) | TCP (Conexão Direta de Aplicativo) |
| **Perfil Emulado** | Navegador Web (Chrome/Firefox) | Aparelho Android (Tablet) | Aparelho Android (Celular master) |
| **Necessita QR Code?**| Sim (via Pareamento Web) | Sim (via Pareamento Web) | Não |
| **Celular Oficial Ativo**| Deve permanecer ativo | Deve permanecer ativo | **Não aplicável (Desloga do celular)** |
| **Risco de Banimento** | Médio | Muito Baixo | Extremamente Baixo |
| **Estabilidade** | Média | Altíssima | Altíssima |

---

## 1. Modos de Conexão em Detalhes

### A. WhatsApp Web (Companion / Aparelho Vinculado)
Este é o método mais comum utilizado pela maioria das APIs de WhatsApp (como Baileys, Evolution API clássica, etc.). O Zapo se conecta aos servidores do WhatsApp fingindo ser uma aba de navegador de computador (como o Chrome ou Safari).

* **Como funciona:** O painel exibe um QR Code. Você abre o WhatsApp no seu celular físico, vai em *Aparelhos Conectados* e escaneia o código.
* **O que acontece no seu celular:** Nada muda. O seu celular continua sendo o dono principal da conta. O Zapo roda como uma sessão secundária autorizada (vinculada).

---

### B. Zapo Mobile (Companion / Aparelho Vinculado) — *Recomendado*
Neste modo, o Zapo utiliza a conexão direta TCP e emula (simula) o protocolo nativo de um aplicativo de **Tablet Android**.

* **Como funciona:** Você seleciona a opção "Zapo Mobile" no formulário de criação da instância. O painel gera um QR Code. Você escaneia o QR Code usando a opção *Aparelhos Conectados* do seu celular físico.
* **Por que é melhor?** Em vez de se comportar como um navegador de computador (que consome mais internet/memória e é muito mais vigiado pelos sistemas anti-spam do WhatsApp), o Zapo se comporta como um aparelho celular/tablet Android nativo. A conexão TCP é muito mais estável, sofre menos quedas de sincronismo e tem uma assinatura de rede que o WhatsApp considera muito mais legítima.
* **O que acontece no seu celular:** O seu celular físico continua sendo o dono principal da conta. O Zapo roda de forma totalmente independente em segundo plano no servidor, sem precisar que o celular físico esteja ligado ou conectado à internet a todo momento.

---

### C. Zapo Mobile (Primário / Aparelho Principal)
Neste modo, o Zapo assume a identidade do **celular principal** do número. Não existe um celular físico atuando como "mestre".

* **Como funciona:** Ele se conecta diretamente à rede do WhatsApp fingindo ser o aplicativo principal instalado em um telefone celular. Não há QR Code para ler, pois não existe outra conta master para se vincular.
* **Como se autenticar:** Como o Zapo não possui uma tela para você solicitar o código SMS de ativação do WhatsApp e digitá-lo (API de registro), você precisa obter as credenciais criptográficas de um número já registrado externamente (via arquivos de sessão gerados por outros scripts de registro) e importá-las diretamente para o banco de dados do Zapo-Manager.
* **O que acontece no seu celular:** 
  > [!CAUTION]
  > **SE VOCÊ CONECTAR O ZAPO COMO PRIMÁRIO, O APLICATIVO DO WHATSAPP NO SEU CELULAR FÍSICO SERÁ DESLOGADO IMEDIATAMENTE.**
  >
  > O WhatsApp permite apenas **um celular principal (primário)** ativo por número. Ao ativar o Zapo como primário, o aplicativo do WhatsApp no seu celular físico exibirá a mensagem *"Você foi desconectado porque este número foi registrado em outro aparelho"*.

---

## ⚠️ Avisos e Regras de Segurança (Anti-Ban)

> [!WARNING]
> ### 1. Concorrência e Conexões Simultâneas (Prevenção de Bloqueio)
> O WhatsApp pune severamente a conexão simultânea de uma mesma sessão em múltiplos locais. 
> * **Regra:** Nunca tente rodar o mesmo número em duas instâncias do Zapo ao mesmo tempo. O Zapo-Manager possui travas virtuais (locks de concorrência) para evitar que isso aconteça acidentalmente.
> * **Aviso:** Se você forçar a abertura da mesma conta em dois servidores simultaneamente, o WhatsApp poderá banir o número temporária ou permanentemente por comportamento suspeito.

> [!IMPORTANT]
> ### 2. O que acontece com o histórico de mensagens e mídias?
> * No modo **Companion / Aparelho Vinculado** (Zapo Mobile / Web): Toda vez que você conecta uma nova instância vinculada, o WhatsApp envia pacotes de sincronização histórica (as conversas antigas). O Zapo processará e guardará essas mensagens no banco de dados. Suas conversas continuam intactas no aplicativo do celular físico.
> * No modo **Primário / Aparelho Principal**: O histórico só existirá no banco de dados do servidor do Zapo. O aplicativo do celular físico não terá acesso a essas mensagens, pois estará deslogado da conta.

> [!TIP]
> ### 3. Chamadas de Voz e Vídeo
> O Zapo-Manager suporta a rejeição automática de chamadas de voz e vídeo recebidas no backend e o envio de uma mensagem de texto automática configurável avisando o usuário que aquele canal não atende ligações de voz/vídeo.

---

## 📋 Exemplos Práticos de Como Usar

### Exemplo 1: Conectando com Zapo Mobile (Companion) - *Modo Padrão Estável*
1. Acesse o painel do Zapo-Manager em `http://localhost:5173`.
2. Clique em **Nova Instância**.
3. Escolha o nome da instância (ex: `atendimento-suporte`).
4. Selecione a integração **Zapo/Baileys** (WHATSAPP-BAILEYS).
5. Ative o interruptor: **"Conexão tipo Mobile (Zapo Mobile)"**.
6. Clique em **Salvar**.
7. O painel exibirá o QR Code.
8. Pegue o seu celular físico, abra o WhatsApp, vá em **Configurações** > **Aparelhos Conectados** > **Conectar um Aparelho**.
9. Escaneie o QR Code na tela do computador.
10. A instância ficará verde com o status **Conectada**. O celular físico pode ser bloqueado ou desligado; o Zapo continuará rodando com alta estabilidade no servidor.

### Exemplo 2: Importando Credenciais (Modo Primário)
Se você possui uma ferramenta que extrai sessões registradas em formato JSON e quer importá-la para rodar de forma primária (sem celular físico):
1. Crie a instância no Zapo-Manager com a opção **Zapo Mobile** ativada, mas **não** escaneie o QR Code.
2. Acesse o seu banco de dados Postgres ou localize o arquivo `.auth/nome_da_instancia.sqlite` no diretório do backend.
3. Insira os dados estruturados de chaves e registros de autenticação dentro do banco de dados ou do arquivo SQLite de autenticação correspondente.
4. Reinicie o backend. O Zapo lerá as credenciais e conectará diretamente sem gerar QR Code, deslogando qualquer celular físico anterior daquele chip.
