# Webshare IP Authorization API Documentation

This document describes the **Webshare IP Authorization API** endpoint (`https://proxy.webshare.io/api/v2/ipauthorization/`), which allows developers to programmatically authorize IP addresses so their servers/containers can connect to Webshare proxies without needing username/password credentials.

This is highly useful for dynamic scaling environments (Kubernetes, AWS ECS, Docker Swarm) where instances start with dynamic IPs and need to auto-authorize themselves at startup.

---

## Base API Endpoint

*   **Base URL**: `https://proxy.webshare.io/api/v2/ipauthorization/`
*   **Headers**:
    *   `Authorization`: `Token <YOUR_API_KEY>` (Required)
    *   `Content-Type`: `application/json`

---

## 1. What's My IP?
Returns the public outward IP address of the client making the request. Useful to auto-detect the current server IP before authorizing it.

*   **URL**: `https://proxy.webshare.io/api/v2/ipauthorization/whatsmyip/`
*   **Method**: `GET`

### Example Response:
```json
{
  "ip": "10.1.2.3"
}
```

---

## 2. List Authorized IPs
Retrieves a paginated list of all currently authorized IP addresses.

*   **URL**: `https://proxy.webshare.io/api/v2/ipauthorization/`
*   **Method**: `GET`
*   **Query Parameters**:
    *   `page`: `integer` (Optional, defaults to `1`)
    *   `page_size`: `integer` (Optional, defaults to `25`)

### Example Response:
```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1337,
      "ip_address": "10.1.2.3",
      "created_at": "2022-06-14T11:58:10.246406-07:00",
      "last_used_at": "2022-08-11T17:12:32.589667-07:00"
    }
  ]
}
```

---

## 3. Authorize a New IP
Adds a new IP address to the authorized list.

*   **URL**: `https://proxy.webshare.io/api/v2/ipauthorization/`
*   **Method**: `POST`
*   **Request Body**:
    ```json
    {
      "ip_address": "10.1.2.3"
    }
    ```

### Example Response (HTTP 201 Created):
```json
{
  "id": 1337,
  "ip_address": "10.1.2.3",
  "created_at": "2022-06-14T11:58:10.246406-07:00",
  "last_used_at": null
}
```

---

## 4. Remove an Authorized IP
Deletes an IP address authorization by its ID.

*   **URL**: `https://proxy.webshare.io/api/v2/ipauthorization/<id>/`
*   **Method**: `DELETE`

### Example Response:
*   **HTTP Status**: `204 No Content`

---

## Automating Authorization at Startup (Node.js Example)

Here is a script you can run in your backend startup routine to automatically detect and authorize the container/server's current public IP address:

```javascript
const API_KEY = process.env.WEBSHARE_API_KEY;

async function autoAuthorizeIP() {
  if (!API_KEY) {
    console.warn("WEBSHARE_API_KEY is not defined, skipping auto IP authorization.");
    return;
  }

  try {
    // 1. Detect current public IP
    const ipRes = await fetch('https://proxy.webshare.io/api/v2/ipauthorization/whatsmyip/');
    const { ip } = await ipRes.json();
    console.log(`Detected public IP: ${ip}`);

    // 2. Check if already authorized
    const listRes = await fetch('https://proxy.webshare.io/api/v2/ipauthorization/', {
      headers: { 'Authorization': `Token ${API_KEY}` }
    });
    const data = await listRes.json();
    const isAuthorized = data.results.some(item => item.ip_address === ip);

    if (isAuthorized) {
      console.log(`IP ${ip} is already authorized in Webshare.`);
      return;
    }

    // 3. Authorize IP
    const authRes = await fetch('https://proxy.webshare.io/api/v2/ipauthorization/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ip_address: ip })
    });

    if (authRes.status === 201) {
      console.log(`Successfully authorized IP ${ip} in Webshare.`);
    } else {
      const errData = await authRes.json();
      console.error("Failed to authorize IP:", errData);
    }
  } catch (err) {
    console.error("Error during auto IP authorization:", err);
  }
}
```
