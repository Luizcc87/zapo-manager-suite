const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

type ProxyConfigLike = {
  enabled?: boolean;
  host?: string;
  port?: string | number;
  protocol?: string;
  username?: string;
  password?: string;
  session?: string;
};

export const buildRegistrationFetchOptions = (
  instanceName: string,
  proxyConfig: unknown,
): Record<string, any> => {
  const rawProxy = (proxyConfig ?? {}) as ProxyConfigLike;

  if (!rawProxy.enabled || !rawProxy.host || !rawProxy.port || !rawProxy.username) {
    return {};
  }

  const protocol = rawProxy.protocol || 'http';
  const auth = rawProxy.session
    ? `${rawProxy.username}-session-${instanceName}:${rawProxy.password || ''}`
    : `${rawProxy.username}:${rawProxy.password || ''}`;
  const proxyUrl = `${protocol}://${auth}@${rawProxy.host}:${rawProxy.port}`;

  try {
    if (protocol === 'socks5' || protocol === 'socks4') {
      const agent = new SocksProxyAgent(proxyUrl);
      return { httpsAgent: agent, httpAgent: agent };
    }

    const agent = new HttpsProxyAgent(proxyUrl);
    return { httpsAgent: agent, httpAgent: agent };
  } catch (error: any) {
    console.warn(
      `[ZapoRouter] [RegisterCode] Falha ao configurar proxy para OTP: ${error?.message || error}`,
    );
    return {};
  }
};
