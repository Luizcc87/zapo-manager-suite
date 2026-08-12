import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Eye, EyeOff, RefreshCw, Key } from 'lucide-react';
import { api } from '@/lib/queries/api';

interface AIIntegrationCardProps {
  apiKey?: string;
  instanceName?: string;
}

export const AIIntegrationCard: React.FC<AIIntegrationCardProps> = ({ apiKey: initialApiKey, instanceName }) => {
  const { t } = useTranslation();
  const [currentApiKey, setCurrentApiKey] = useState<string | undefined>(initialApiKey);
  const [showToken, setShowToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const host = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
  const headerMcpUrl = `${host}/mcp`;
  
  const displayToken = currentApiKey
    ? showToken
      ? currentApiKey
      : `${currentApiKey.slice(0, 4)}${'•'.repeat(Math.max(0, currentApiKey.length - 8))}${currentApiKey.slice(-4)}`
    : '<API_KEY>';

  const urlMcpUrl = currentApiKey
    ? showToken
      ? `${host}/mcp/${currentApiKey}`
      : `${host}/mcp/${currentApiKey.slice(0, 4)}${'•'.repeat(Math.max(0, currentApiKey.length - 8))}${currentApiKey.slice(-4)}`
    : `${host}/mcp/<API_KEY>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRotateKey = async () => {
    if (!instanceName || !currentApiKey) return;
    const confirmed = window.confirm(
      'Tem certeza que deseja revogar o token atual e gerar um novo? Clientes MCP ativos precisarão da nova chave.'
    );
    if (!confirmed) return;

    try {
      setRotating(true);
      const res = await api.post(`/instance/rotate-key/${instanceName}`, {}, { headers: { apikey: currentApiKey } });
      if (res.data?.apiKey) {
        setCurrentApiKey(res.data.apiKey);
        toast.success('Token revogado e recriado com sucesso!');
      }
    } catch (err: any) {
      toast.error('Erro ao revogar token: ' + (err.response?.data?.error || err.message));
    } finally {
      setRotating(false);
    }
  };

  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        'zapo-manager': {
          url: currentApiKey ? `${host}/mcp/${currentApiKey}` : `${host}/mcp/<API_KEY>`,
        },
      },
    },
    null,
    2
  );

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🤖 {t('ai_integration.title', 'Integração com Agentes de IA (MCP)')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'ai_integration.description',
              'Conecte assistentes de IA (Claude, Cursor, Windsurf, ChatGPT) ao Zapo Manager via Model Context Protocol (MCP).'
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-border">
        {/* Painel do Token da Instância com Revelar / Revogar */}
        <div className="rounded-md border border-border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-primary" />
              Token de Autenticação da Instância
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-input bg-background hover:bg-accent transition-colors"
                title={showToken ? 'Ocultar Token' : 'Revelar Token'}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showToken ? 'Ocultar' : 'Revelar'}</span>
              </button>
              {instanceName && (
                <button
                  type="button"
                  onClick={handleRotateKey}
                  disabled={rotating}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title="Revogar token atual e gerar novo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
                  <span>Revogar & Recriar</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs font-mono select-all">
              {displayToken}
            </code>
            {currentApiKey && (
              <button
                type="button"
                onClick={() => copyToClipboard(currentApiKey, 'token')}
                className="px-3 py-1.5 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {copiedKey === 'token' ? '✓ Copiado!' : 'Copiar Token'}
              </button>
            )}
          </div>
        </div>

        {/* URL com Token embutido */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            {t('ai_integration.url_token_label', 'Endpoint HTTP MCP (Com Token na URL - ChatGPT, Openclaw, N8N)')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={urlMcpUrl}
              className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(currentApiKey ? `${host}/mcp/${currentApiKey}` : urlMcpUrl, 'url')}
              className="px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {copiedKey === 'url' ? '✓ Copiado!' : 'Copiar URL'}
            </button>
          </div>
        </div>

        {/* URL Padrão com Header */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            {t('ai_integration.header_token_label', 'Endpoint HTTP MCP (Requer Header apikey - Claude, Cursor)')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={headerMcpUrl}
              className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(headerMcpUrl, 'header')}
              className="px-3 py-2 text-xs font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {copiedKey === 'header' ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Snippet para Cursor / Claude Desktop */}
        <details className="mt-2 text-xs group">
          <summary className="cursor-pointer font-medium text-primary hover:underline flex items-center gap-1 select-none">
            📄 {t('ai_integration.snippet_toggle', 'Ver snippet de configuração para Cursor IDE (.cursor/mcp.json)')}
          </summary>
          <div className="mt-2 relative">
            <pre className="p-3 bg-muted rounded-md font-mono text-[11px] overflow-x-auto text-foreground">
              {cursorSnippet}
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(cursorSnippet, 'snippet')}
              className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-background border border-input hover:bg-accent"
            >
              {copiedKey === 'snippet' ? '✓ Copiado' : 'Copiar JSON'}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};
