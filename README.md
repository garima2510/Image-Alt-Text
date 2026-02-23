# Multimodal Image Alt-Text Generator & Translator

Generate English alt text from product image URLs using Azure OpenAI (Phi-4 multimodal) and optionally translate it into multiple languages. The project explores three different hosting approaches and includes a chat-style web UI.

## Project Structure

```
├── Azure-Function/          # Azure Functions app (Python v2 programming model)
├── Azure-Container-Apps/    # Flask + Gunicorn container app (two variants)
│   ├── container_app.py     #   → Translation via SLM (Azure OpenAI)
│   └── alt_translate.py     #   → Translation via Azure Translator REST API
├── Static-Web-App/          # Chat UI frontend (Azure Static Web Apps)
├── Jupyter/                 # Notebook used for initial exploration
└── .github/workflows/       # GitHub Actions for SWA deployment
```

## Approaches

### 1. Azure Functions (`Azure-Function/`)

Serverless HTTP endpoint using the Python v2 programming model. Translation is handled by the same SLM used for alt-text generation.

- Endpoint: `POST /api/alt-text`
- See [Azure-Function/README.md](Azure-Function/README.md) for troubleshooting notes.

### 2. Azure Container Apps (`Azure-Container-Apps/`)

Flask + Gunicorn app running in a Docker container. Two app files exist:

| File | Translation method |
|---|---|
| `container_app.py` | Uses Azure OpenAI (SLM) to translate |
| `alt_translate.py` | Uses Azure Translator REST API (current/active) |

- Endpoint: `POST /alt-translate`
- See [Azure-Container-Apps/README.md](Azure-Container-Apps/README.md) for deployment steps.

### 3. Static Web App (`Static-Web-App/`)

Chat-style frontend that calls the Container App backend. Users paste an image URL, pick target languages (checkboxes or free-text names like "Tamil"), and see translations in a table.

- Deployed via the Azure Static Web Apps VS Code extension or GitHub Actions (manual trigger).
- See [Static-Web-App/README.md](Static-Web-App/README.md) for configuration and gotchas (CORS, EasyAuth, Translator headers).

## API Request / Response

### Request

```json
{
  "image_url": "https://example.com/product.jpg",
  "target_language_codes": ["nl", "de", "fr"]
}
```

- `image_url` (required) — public image URL
- `target_language_codes` (optional) — ISO language codes; omit for English only

### Response

```json
{
  "translations": {
    "en": "Desktop Epson printer with three ink refills.",
    "nl": "Desktop Epson-printer met drie inktnavullingen.",
    "de": "Desktop-Epson-Drucker mit drei Tintennachfüllungen.",
    "fr": "Imprimante Epson de bureau avec trois recharges d'encre."
  }
}
```

## Authentication

All approaches use `DefaultAzureCredential`. In Azure, attach a user-assigned managed identity and set `AZURE_CLIENT_ID` to its client ID. The identity needs the **Cognitive Services User** role on both the Azure OpenAI and Azure Translator resources.

## Required Environment Variables

| Variable | Purpose |
|---|---|
| `ENDPOINT_URL` | Azure OpenAI endpoint |
| `DEPLOYMENT_NAME` | Model deployment name (e.g. Phi-4-multimodal-instruct) |
| `API_VERSION` | Azure OpenAI API version |
| `TRANSLATOR_ENDPOINT` | Azure Translator endpoint (global or regional) |
| `TRANSLATOR_REGION` | Translator region — full name, e.g. `eastus2` |
| `TRANSLATOR_RESOURCE_ID` | Full resource ID of the Translator account |
| `AZURE_CLIENT_ID` | Client ID of the user-assigned managed identity |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (Container App only) |
