---
name: infrastructure
description: "Requisitos de rede, portas TCP, VPS e funcionamento sob Cloudflare Tunnel"
metadata:
  node_type: memory
  type: infrastructure
---

# Infraestrutura de Rede e Conexões

## 🔌 Requisitos de Portas para Conexões Mobile
As conexões do tipo **Mobile** (seja o pareamento Companion via QR Code ou Registro Primário via SMS/Voz) utilizam o protocolo TCP nativo de aplicativos celulares para se comunicar com o WhatsApp.

* **Porta TCP 5222:** É a porta primária de conexão de saída (outbound) utilizada pelo Zapo para se conectar aos servidores do WhatsApp (`web.whatsapp.com`, `g.us`, etc.).
* **Porta TCP 443:** Usada como fallback de rede. No entanto, é mais instável para sessões móveis nativas e pode ser rejeitada em ambientes mais rígidos.
* **Bloqueios comuns:** Portas de saída como a `5222` são comumente bloqueadas por padrão em conexões de internet residenciais e corporativas rígidas por motivos de segurança/antispam. Se estiver bloqueada, o painel do Zapo exibirá aviso preventivo no console (`⚠️ PORTA 5222 BLOQUEADA`) e falhará ao gerar o QR Code.

---

## 🐳 Comportamento em VPS, Docker e Cloudflare Tunnel

Esta arquitetura funciona de forma otimizada sob o seguinte setup de produção:

1. **Conexões de Saída (Outbound - Zapo -> WhatsApp):**
   * VPS (AWS, DigitalOcean, Hetzner, etc.) possuem todas as portas de saída liberadas por padrão (incluindo a `5222`).
   * A rede interna do Docker (bridge) permite saídas automáticas para qualquer porta externa. **Não é necessário expor a porta 5222 no container** (bloco `ports:` do docker-compose).

2. **Conexões de Entrada (Inbound - Usuário -> Painel) via Cloudflare Tunnel (`cloudflared`):**
   * O Cloudflare Tunnel funciona de forma segura e encapsulada para o tráfego HTTP de entrada na porta da API (`8080`) e do frontend.
   * O Túnel **não afeta, não intercepta e não limita** as conexões de saída TCP que o container faz diretamente para o WhatsApp.
   * Esse setup garante que nenhuma porta de entrada (inbound) precise ser aberta diretamente no firewall físico da VPS, maximizando a segurança do servidor.
