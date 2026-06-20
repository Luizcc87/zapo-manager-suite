# Webshare Proxy Connection Documentation

This document describes how to connect to the **Webshare Proxy Server**, covering authentication modes, targeting features (countries, cities, sticky sessions vs. rotating IPs), and configuration examples.

---

## Connection Servers & Ports

Webshare supports two primary authentication and connection methods:

1.  **Backconnect (Rotating/Proxy Pool)**:
    *   **HTTP/S Protocol Host**: `p.webshare.io` (Port `80`)
    *   **SOCKS5 Protocol Host**: `p.webshare.io` (Port `1080` / SOCKS5 connection)
2.  **Direct Proxies**:
    *   Using individual proxy IPs allocated to your plan (e.g., `1.2.3.4` on port `8168` or similar).

---

## Authentication Modes

### 1. Username / Password Authentication
Authenticate by embedding your credentials directly into the proxy URL. This is the most common configuration.

```bash
curl --proxy "http://username:password@p.webshare.io:80/" https://ipv4.webshare.io/
```

### 2. IP Authorization (Passwordless)
If you authorize your server's IP address within the Webshare Dashboard, you can connect directly without providing credentials.

```bash
curl --proxy "http://1.2.3.4:8168/" https://ipv4.webshare.io/
```

---

## Advanced Targeting (Username Suffixes)

You can customize proxy routing dynamically on each connection by appending special suffixes to your username. The syntax is:

`username-[country_code]-[city]-[session_or_rotate]`

### Targeting Specific Countries
Add a 2-letter ISO country code to target proxies in a specific nation:

```bash
# Target USA (United States)
curl --proxy "http://myuser-us:password@p.webshare.io:80/" https://ipv4.webshare.io/
```

### Targeting Specific Cities
Add a city prefix to route traffic through a specific location:

```bash
# Target US, Los Angeles
curl --proxy "http://myuser-us-city_los_angeles:password@p.webshare.io:80/" https://ipv4.webshare.io/
```

### Session Persistence (Sticky Sessions)
To maintain the same proxy IP across multiple requests (highly recommended for WhatsApp bots to prevent session drops), append a session ID of your choice.

```bash
# US, sticky session ID "1234"
curl --proxy "http://myuser-us-1234:password@p.webshare.io:80/" https://ipv4.webshare.io/

# Germany, Munich, sticky session ID "1234"
curl --proxy "http://myuser-de-city_munich-1234:password@p.webshare.io:80/" https://ipv4.webshare.io/
```

### Forcing Rotation
To force the proxy IP to rotate on every request:

```bash
# US, Los Angeles, rotating IP
curl --proxy "http://myuser-us-city_los_angeles-rotate:password@p.webshare.io:80/" https://ipv4.webshare.io/
```

---

## Code Examples

### Node.js (with `undici` for Zapo Client)

Using `undici` to proxy HTTP requests for Zapo (media downloads, link previews, etc.):

```javascript
import { ProxyAgent } from 'undici';

// US sticky session proxy
const proxyUrl = 'http://myuser-us-session1:password@p.webshare.io:80';
const dispatcher = new ProxyAgent(proxyUrl);

// Use this dispatcher in Zapo ClientOptions
const client = new WaClient({
  store,
  sessionId: 'my-session',
  proxy: {
    mediaUpload: dispatcher,
    mediaDownload: dispatcher,
    linkPreview: dispatcher
  }
});
```

### Node.js (with `socks-proxy-agent` for SOCKS5)

```javascript
import { SocksProxyAgent } from 'socks-proxy-agent';

// SOCKS5 US sticky session proxy
const proxyUrl = 'socks5://myuser-us-session1:password@p.webshare.io:1080';
const agent = new SocksProxyAgent(proxyUrl);

const client = new WaClient({
  store,
  sessionId: 'my-session',
  proxy: {
    ws: agent,
    mediaUpload: agent,
    mediaDownload: agent,
    linkPreview: agent
  }
});
```
