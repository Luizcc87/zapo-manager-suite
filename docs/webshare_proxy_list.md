# Webshare Proxy List API Documentation

This document describes the **Webshare Proxy List API** endpoints, which allow programmatically listing and downloading proxies assigned to your plan.

---

## 1. List Proxies (JSON / Paginated)
Retrieves a paginated list of all active proxies with details about their country, city, last verification time, and credentials.

*   **URL**: `https://proxy.webshare.io/api/v2/proxy/list/`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization`: `Token <YOUR_API_KEY>` (Required)
*   **Query Parameters**:
    *   `mode`: `string` (`direct` or `backconnect`. Defaults to `direct`. Direct mode fetches the list of dedicated proxy IPs).
    *   `page`: `integer` (Optional, defaults to `1`)
    *   `page_size`: `integer` (Optional, defaults to `25`)

### Python Example:
```python
import requests

url = "https://proxy.webshare.io/api/v2/proxy/list/"
params = {
    "mode": "direct",
    "page": 1,
    "page_size": 25
}
headers = {
    "Authorization": "Token YOUR_API_KEY"
}

response = requests.get(url, params=params, headers=headers)
print(response.json())
```

### JSON Response Schema:
```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "d-10513",
      "username": "username",
      "password": "password",
      "proxy_address": "1.2.3.4",
      "port": 8168,
      "valid": true,
      "last_verification": "2019-06-09T23:34:00.095501-07:00",
      "country_code": "US",
      "city_name": "New York",
      "created_at": "2022-06-14T11:58:10.246406-07:00"
    }
  ]
}
```

---

## 2. Download Proxy List (Plain Text / Highly Optimized)
A fast, lightweight endpoint to download all proxies in plain text format (`ip:port:username:password`). This is recommended for quick synchronization.

*   **URL**: `https://proxy.webshare.io/api/v2/proxy/list/download/{token}/{country_codes}/{any}/{authentication_method}/{endpoint_mode}/{search}/`
*   **Method**: `GET`
*   **URL Route Placeholders**:
    *   `{token}`: Your Webshare download token (found on the Webshare Dashboard, distinct from the API Key token).
    *   `{country_codes}`: ISO 2-letter country codes separated by comma, or `-` for all.
    *   `{any}`: Pass `any` or filter parameter.
    *   `{authentication_method}`: `username` or `ip` (defines format).
    *   `{endpoint_mode}`: `direct` (regular IPs) or `backconnect` (rotating gateway ports).
    *   `{search}`: Optional URL-encoded search keyword (e.g. `san%20francisco` to filter by city).

### Example Request URL:
```text
https://proxy.webshare.io/api/v2/proxy/list/download/YOUR_DOWNLOAD_TOKEN/-/any/username/direct/san%20francisco/
```

### Plain Text Response Example:
```text
10.1.2.3:9421:username:password
10.1.2.4:6511:username:password
```
