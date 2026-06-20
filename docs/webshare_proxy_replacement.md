# Webshare Proxy Replacement API Documentation

This document describes the **Webshare Proxy Replacement API** endpoints, which allow programmatically replacing proxies assigned to your plan.

If a proxy IP gets flagged by WhatsApp (causing pairing errors or connection drops), you can automate its replacement.

---

## 1. Request Proxy Replacement
Requests Webshare to replace one or more proxy IPs.

*   **URL**: `https://proxy.webshare.io/api/v3/proxy/replace/`
*   **Method**: `POST`
*   **Headers**:
    *   `Authorization`: `Token <YOUR_API_KEY>` (Required)
    *   `Content-Type`: `application/json`
*   **Request Body**:
    *   `to_replace` (object, required):
        *   `type`: `ip_address` or `ip_range`
        *   `ip_addresses` (array of string, when type is `ip_address`): Specific IPs to replace.
        *   `ip_ranges` (array of string, when type is `ip_range`): Specific IP ranges to replace.
    *   `replace_with` (array of object, required):
        *   `type`: `any`, `country`, `ip_range`, or `asn`
        *   `count` (integer, when type is `any`): Count of proxies to return.
        *   `country_code` (string, when type is `country`): 2-letter ISO country code.
        *   `ip_ranges` (array of string, when type is `ip_range`): Specific target range.
        *   `asn_numbers` (array of integer, when type is `asn`): Specific ASN routing numbers.
    *   `dry_run` (boolean, optional): If `true`, validates replacement options without applying them. Defaults to `false`.

---

## Examples

### Example A: Replace Specific IPs with Any Available Proxy
```python
import requests

url = "https://proxy.webshare.io/api/v3/proxy/replace/"
headers = {
    "Authorization": "Token YOUR_API_KEY",
    "Content-Type": "application/json"
}
body = {
    "to_replace": {
        "type": "ip_address",
        "ip_addresses": ["1.2.3.4", "1.2.3.5"]
    },
    "replace_with": [
        {
            "type": "any",
            "count": 2
        }
    ],
    "dry_run": False
}

response = requests.post(url, json=body, headers=headers)
print(response.json())
```

### Example B: Replace IP Range with a US Proxy
```python
import requests

url = "https://proxy.webshare.io/api/v3/proxy/replace/"
headers = {
    "Authorization": "Token YOUR_API_KEY",
    "Content-Type": "application/json"
}
body = {
    "to_replace": {
        "type": "ip_range",
        "ip_ranges": ["1.2.3.0/24"]
    },
    "replace_with": [
        {
            "type": "country",
            "country_code": "US"
        }
    ],
    "dry_run": False
}

response = requests.post(url, json=body, headers=headers)
print(response.json())
```

---

## Response JSON Schema

### Example Response:
```json
{
    "id": 98315,
    "reason": "proxy_replaced",
    "to_replace": {
        "type": "ip_address",
        "ip_addresses": ["1.2.3.4", "1.2.3.5"]
    },
    "replace_with": [
        {
            "type": "any",
            "count": 2
        }
    ],
    "dry_run": false,
    "state": "completed",
    "proxies_removed": 2,
    "proxies_added": 2,
    "error": null,
    "error_code": null,
    "created_at": "2022-07-26T21:25:13.966946-07:00",
    "completed_at": "2022-07-26T21:25:15.110294-07:00"
}
```

### Response Field Descriptions

*   **`id`** (integer): Unique identifier for this replacement transaction.
*   **`state`** (string): The replacement status, e.g. `validating`, `completed`, `failed`.
*   **`proxies_removed`** (integer): Total number of old proxies unassigned from your account.
*   **`proxies_added`** (integer): Total number of new proxies allocated to your account.
*   **`error`** (string | null): Error message if the operation failed.
*   **`error_code`** (string | null): Standardized error identifier.
*   **`created_at`** (string): Transaction start time.
*   **`completed_at`** (string | null): Transaction finalization time.
