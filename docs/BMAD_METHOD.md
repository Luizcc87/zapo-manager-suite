# Metodologia BMAD (BMAD Method v6.10.0)

Este documento descreve os conceitos fundamentais, fluxos de trabalho e as diretrizes operacionais do **BMAD Method (v6.10.0)** instalados e integrados a este repositório.

---

## 🚀 Estado instalado em 2026-07-13

O manifesto local em `_bmad/_config/manifest.yaml` indica:

| Módulo | Versão |
|---|---|
| core | 6.10.0 |
| bmm | 6.10.0 |
| tea | v1.19.0 |
| bmb | v2.1.0 |
| cis | v0.2.1 |
| wds | v0.4.3 |
| bmad-loop | v0.8.1 |

IDEs configuradas: Claude Code, Codex, Antigravity e Kilo.

## 🚀 Novidades Importantes desde a linha 6.9.x

A linha 6.10 mantém a transição para `uv`, a memória compartilhada e os fluxos lean introduzidos na 6.9.x, e neste repositório adiciona o módulo externo `bmad-loop`.

### 1. ⚠️ Transição para o `uv` como Padrão de Execução (Breaking Change na v7)
*   **O que mudou:** A comunidade e a arquitetura BMAD estão convergindo para o uso de `uv` (da Astral) para rodar scripts Python de forma isolada e consistente.
*   **Padrão de Execução:** Em vez de executar scripts chamando `python3` diretamente, todos os fluxos e customizações que chamam scripts Python devem migrar para:
    ```bash
    uv run <caminho_do_script>
    ```
*   **Nota de Compatibilidade:** Na versão 6.9.0, o instalador já avisa se o `uv` estiver ausente, mas não bloqueia. Na **versão 7**, o uso de `uv run` será o padrão assumido e obrigatório. 
*   **Ação Recomendada:** Certifique-se de que o `uv` está instalado e acessível no path do sistema de desenvolvimento.

### 2. 💡 Novo Skill Core: `bmad-forge-idea`
*   **Objetivo:** Pegar ideias brutas ou pouco detalhadas na fase de análise e testá-las sob pressão (stress-testing) antes de gastar recursos de engenharia.
*   **Como Funciona:** Realiza um questionamento socrático iterativo (uma pergunta por vez) usando:
    *   **Modo de Ataque Adversarial** para encontrar falhas de premissa.
    *   **Salas de Personas** (customizadas e baseadas nos agentes instalados) para colher perspectivas multifacetadas.
*   **Saída:** Produz resíduos de logs de memória (`memlog`) e opcionalmente um brief que alimenta diretamente os fluxos de especificação (`bmad-spec`) ou desenvolvimento rápido (`bmad-quick-dev`).
*   **Invocação:** Modo interativo com código de menu `FI`.

### 3. 🏛️ Nova Arquitetura Lean: `bmad-architecture`
*   **O que mudou:** O antigo fluxo multi-etapas `bmad-create-architecture` foi reescrito do zero e consolidado no `bmad-architecture` (o antigo agora é um shim temporário e será removido na v7).
*   **Espinha Dorsal (`ARCHITECTURE-SPINE.md`):** É o novo arquivo que serve como fonte única de verdade arquitetural. O arquivo `SPEC.md` é derivado diretamente dessa espinha dorsal.
*   **Roteamento por Intenção:** Suporta 5 formas de entrada para criar/atualizar/validar arquiteturas:
    1.  Ideia bruta (*raw idea*).
    2.  Documento grande (*large doc*).
    3.  Código-fonte existente (*codebase*).
    4.  Fatia de funcionalidade (*feature slice*).
    5.  Espinha dorsal existente (*existing spine*).
*   **Rubrica de Cobertura de Largura:** Nenhuma dimensão técnica (segurança, persistência, concorrência, etc.) é pulada; todas são marcadas explicitamente como *decididas*, *postergadas (deferred)* ou *em aberto (open)*.
*   **Validação Rígida:** O script `lint_spine.py` valida as seções e tabelas da espinha dorsal.

### 4. 👥 Party Mode com Memória Persistente e Customização
*   **Customização de Equipes:** Suporta personas customizadas (`party_members`) e salas nomeadas (`party_groups` com cenas).
*   **Memória de Sessão:** Cada "festa" de agentes agora salva uma memória cronológica sob `{memory_dir}/<party_id>/`. Isso permite que sessões de debate e revisão de código continuem com o contexto anterior preservado.
*   **Equipe Padrão:** Vem pré-carregado com a **Code Review Crew** (5 lentes adversariais para revisão estrita de código).

### 5. 🧠 Memória Compartilhada Canônica (`memlog.py`)
*   **Arquivo Central:** Localizado em `_bmad/scripts/memlog.py`.
*   **Função:** Substitui os logs de decisão individuais de cada skill por uma memória cronológica única de append-only. É a primitiva padrão para leitura/escrita de progresso cognitivo no BMAD.

### 6. 📝 Ações de Retrospectiva no Status do Sprint
*   **Vínculo com Retrospectivas:** O fluxo de retrospectiva gera e insere tarefas prioritárias diretamente na seção `action_items` do `sprint-status.yaml`.
*   **Preservação:** O planejador de sprints (`sprint-planning`) preserva esses itens em regenerações futuras, garantindo que débitos de processo sejam de fato resolvidos.

### 7. 🔁 BMAD Loop instalado
*   **Módulo:** `bmad-loop` v0.8.1.
*   **Skills locais:** `bmad-loop-setup`, `bmad-loop-resolve` e `bmad-loop-sweep`.
*   **Uso:** reservar para runs automatizados de dev/review com resolução de escalations e triagem de deferred work. Não substituir os gates locais de Playwright do Zapo Manager por loop automatizado sem uma história ou story-key explícita.

### 8. 🧪 Skill local para testes do Manager
*   **Skill:** `.agents/skills/zapo-manager-test-runner`.
*   **Função:** rodar os gates `test:manager:api`, `test:manager:ui` e `test:manager` sem misturar envios reais de WhatsApp.
*   **Detalhes:** ver `docs/zapo/manager-local-tests.md`.

---

## 🛠️ Como Utilizar os Comandos no Dia a Dia

Para desenvolvedores e agentes trabalhando neste repositório:
*   Use `/bmad-help` para explorar o catálogo de habilidades disponíveis e entender qual é a melhor rota para o objetivo atual.
*   Para iniciar uma análise profunda de uma feature conceitual, use `bmad-forge-idea`.
*   Sempre use a estrutura baseada no `ARCHITECTURE-SPINE.md` para decisões técnicas do monorepo, mantendo a isolação entre `frontend/` e `backend/`.
*   Para validar a estrutura local de testes do Manager, use a skill `zapo-manager-test-runner` ou rode `npm run test:manager`.
