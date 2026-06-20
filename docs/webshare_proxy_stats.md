# Webshare Proxy Stats API Documentation

This document describes the **Webshare Proxy Stats API** endpoint (`https://proxy.webshare.io/api/v2/stats/`), detailing how to retrieve proxy utilization, bandwidth, request rates, error reasons, and geographical usage.

---

## Endpoint Details

*   **URL**: `https://proxy.webshare.io/api/v2/stats/`
*   **Method**: `GET`
*   **Headers**:
    *   `Authorization`: `Token <YOUR_API_KEY>` (Required)
    *   `Content-Type`: `application/json`

---

## Query Parameters

You can filter the statistics using the following query parameters:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `timestamp__gte` | `string` (ISO 8601) | No | Start date/time of the window (e.g., `2022-08-09T23:34:00.095501-07:00`) |
| `timestamp__lte` | `string` (ISO 8601) | No | End date/time of the window (e.g., `2022-09-09T23:34:00.095501-07:00`) |
| `plan_id` | `string` | No | Filters stats only for a specific plan ID |

---

## Example Request

### Curl
```bash
curl -X GET "https://proxy.webshare.io/api/v2/stats/?timestamp__gte=2022-08-09T23:34:00Z&timestamp__lte=2022-09-09T23:34:00Z" \
  -H "Authorization: Token YOUR_API_KEY"
```

### Python
```python
import requests

url = "https://proxy.webshare.io/api/v2/stats/"
params = {
    "timestamp__gte": "2022-08-09T23:34:00.095501-07:00",
    "timestamp__lte": "2022-09-09T23:34:00.095501-07:00"
}
headers = {
    "Authorization": "Token YOUR_API_KEY"
}

response = requests.get(url, params=params, headers=headers)
stats = response.json()
print(stats)
```

### Node.js (Fetch)
```javascript
const url = new URL('https://proxy.webshare.io/api/v2/stats/');
url.searchParams.append('timestamp__gte', '2022-08-09T23:34:00Z');
url.searchParams.append('timestamp__lte', '2022-09-09T23:34:00Z');

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': 'Token YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const stats = await response.json();
console.log(stats);
```

---

## Response Schema

The response returns a JSON array of stats objects:

```json
[
  {
    "timestamp": "2022-08-11T17:00:00-07:00",
    "is_projected": false,
    "bandwidth_total": 5000,
    "bandwidth_average": 1000,
    "requests_total": 5,
    "requests_successful": 4,
    "requests_failed": 1,
    "error_reasons": [
      {
        "reason": "client_connect_forbidden_host",
        "type": "configuration",
        "how_to_fix": "The target website you are connecting cannot be accessed via Webshare Proxy.",
        "http_status": 403,
        "count": 1
      }
    ],
    "countries_used": {
      "GB": 1,
      "FR": 4
    },
    "number_of_proxies_used": 2,
    "protocols_used": {
      "http": 5
    },
    "average_concurrency": 0.0001388888888888889,
    "average_rps": 0.0002777777777777778,
    "last_request_sent_at": "2022-08-11T17:12:32.589667-07:00"
  }
]
```

### Response Field Descriptions

*   **`timestamp`** (string): The start of the time interval for this data point.
*   **`is_projected`** (boolean): Indicates if the data is projected (estimated) or finalized.
*   **`bandwidth_total`** (number): Total bandwidth consumed during the interval (in bytes).
*   **`bandwidth_average`** (number): Average bandwidth consumed per request.
*   **`requests_total`** (integer): Total number of requests sent.
*   **`requests_successful`** (integer): Number of successful requests (typically HTTP status 2xx).
*   **`requests_failed`** (integer): Number of failed requests.
*   **`error_reasons`** (array): Details about failed requests:
    *   `reason` (string): Standardized error identifier (e.g. `client_connect_forbidden_host`).
    *   `type` (string): Error classification (e.g. `configuration`).
    *   `how_to_fix` (string): Actionable advice to resolve the error.
    *   `http_status` (integer): HTTP status code returned to the client (e.g. `403`).
    *   `count` (integer): Number of times this error occurred during the interval.
*   **`countries_used`** (object): Map of ISO country codes to the number of requests routed through proxies in those countries.
*   **`number_of_proxies_used`** (integer): Distinct count of proxies active in the interval.
*   **`protocols_used`** (object): Map of protocols (e.g., `http`, `socks5`) to the request count.
*   **`average_concurrency`** (number): Average concurrent connections in the interval.
*   **`average_rps`** (number): Average requests per second.
*   **`last_request_sent_at`** (string): Timestamp of the last request sent.
