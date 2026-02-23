# Static Web App — Alt-Text Translator UI

A chat-style web interface deployed on **Azure Static Web Apps** that lets users paste a product image URL, select target languages, and receive AI-generated alt text with Azure Translator translations.

## Architecture

```
┌──────────────────────────┐        POST /alt-translate        ┌──────────────────────────────┐
│  Azure Static Web App    │  ──────────────────────────────▶   │  Azure Container App         │
│                          │                                   │                              │
│  index.html / app.js     │  ◀──────────────────────────────   │  Flask + Gunicorn            │
│  style.css               │      JSON { translations }        │  alt_translate.py            │
└──────────────────────────┘                                   └──────────┬───────────────────┘
                                                                          │
                                                         ┌────────────────┼────────────────┐
                                                         │                │                │
                                                         ▼                ▼                ▼
                                                   Azure OpenAI    Azure Translator   Managed Identity
                                                   (Phi-4)         (REST API)         (user-assigned)
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Chat UI with image URL input, 12 language checkboxes, and a custom language text field |
| `style.css` | Dark-themed chat styling |
| `app.js` | Frontend logic — calls the Container App API, resolves language names to codes via Azure Translator's public `/languages` endpoint |
| `staticwebapp.config.json` | SPA fallback routing (rewrites all paths to `index.html`) |

## How It Works

1. User pastes a product image URL and selects target languages (optional — defaults to English only).
2. The custom language field accepts human-readable names (e.g. "Tamil", "Arabic") or ISO codes (e.g. "ta", "ar"). On page load, `app.js` fetches the full list of supported languages from Azure Translator's public endpoint and builds a name → code lookup map.
3. The frontend POSTs `{ image_url, target_language_codes }` to the Container App's `/alt-translate` endpoint.
4. The Container App generates English alt text using Azure OpenAI (Phi-4 multimodal), then translates it into the requested languages via Azure Translator.
5. Results are displayed in a table in the chat.

## Deployment

### Static Web App

Deployed via the **Azure Static Web Apps VS Code extension** (no Node.js/npm required).

A GitHub Actions workflow is also configured for manual re-deployment:

- Workflow: `.github/workflows/azure-static-web-apps-<swa-name>.yml`
- Trigger: `workflow_dispatch` (manual only)
- Source folder: `/Static-Web-App`
- Secret: `AZURE_STATIC_WEB_APPS_API_TOKEN_<SWA_NAME>` (auto-created by the SWA extension)

### Container App (backend)

| Property | Value |
|---|---|
| App name | `<container-app-name>` |
| Resource group | `<resource-group>` |
| Registry | `<registry>.azurecr.io` |
| Image | `<container-app-name>:<tag>` |
| Port | 8080 |
| Identity | User-assigned managed identity |

Build & deploy the container:

```powershell
az acr build --registry <registry> --image <container-app-name>:<tag> .
az containerapp update -n <container-app-name> -g <resource-group> --image <registry>.azurecr.io/<container-app-name>:<tag>
```

## Key Configuration & Gotchas

### CORS

The Container App uses `flask-cors` to handle cross-origin requests from the Static Web App.

- The env var `ALLOWED_ORIGINS` on the Container App must be set to the SWA hostname:
  ```
  ALLOWED_ORIGINS=https://<swa-hostname>.azurestaticapps.net
  ```
- Multiple origins can be comma-separated.
- For local development the default is `*` (allow all).

### EasyAuth Must Be Disabled

Azure Container Apps has a platform-level authentication feature ("EasyAuth"). If enabled, it intercepts **all** incoming requests — including CORS preflight `OPTIONS` requests — and returns `401 Unauthorized` before they ever reach Flask. This was the root cause of persistent CORS failures.
In internal subscriptions, use the Security tag

```powershell
# Verify auth is disabled
az containerapp auth show -n <container-app-name> -g <resource-group> --query "platform.enabled"
# Should return: false

# Disable if needed
az containerapp auth update -n <container-app-name> -g <resource-group> --enabled false
```

### Azure Translator — Global Endpoint with Managed Identity

When using the global Translator endpoint (`api.cognitive.microsofttranslator.com`) with AAD/managed identity tokens, three headers are required:

```
Authorization: Bearer <token>
Ocp-Apim-ResourceId: /subscriptions/.../Microsoft.CognitiveServices/accounts/<translator-name>
Ocp-Apim-Subscription-Region: <region>
```

- The region must be the **full name** (e.g. `eastus2`), not the abbreviation (`eus2`).
- The `Ocp-Apim-ResourceId` header is mandatory for AAD tokens on the global endpoint.

### Language Codes

Azure Translator uses specific codes that differ from common assumptions:

| Language | Correct code | Common mistake |
|---|---|---|
| Simplified Chinese | `zh-Hans` | `zh` |
| Norwegian (Bokmål) | `nb` | `no` |

The frontend resolves language names to codes dynamically by querying Azure Translator's public `/languages` endpoint at startup.

## Local Development

Open `index.html` directly in a browser. The `API_URL` in `app.js` points to the deployed Container App. For local backend testing, change it to `http://localhost:8080/alt-translate`.

## Required Azure Resources

| Resource | Purpose |
|---|---|
| Azure Static Web App | Hosts the frontend UI |
| Azure Container App | Hosts the Flask/Gunicorn backend API |
| Container App Environment | Shared environment for the Container App |
| Azure Container Registry | Stores the Docker image |
| Azure Translator | Translates alt text into target languages |
| Azure OpenAI | Generates English alt text from images (Phi-4 multimodal) |
| User-assigned Managed Identity | Authenticates to Translator and OpenAI without keys |
