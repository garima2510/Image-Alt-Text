# Multimodal Image Alt Text (Azure Functions)

Generate English alt text from an image URL and optionally translate it to multiple languages using Foundry Models and Azure OpenAI SDK. The Azure Function exposes a single HTTP endpoint.

## Project Structure

- Azure-Function/ - Azure Functions app (Python)
- Jupyter/ - Notebook used for initial exploration
- system_prompt.txt - Base prompt for alt text generation

## Endpoint

POST /api/alt-text

### Request Body

```json
{
  "image_url": "https://example.com/product.jpg",
  "target_language_codes": ["nl", "de"]
}
```

- image_url (required): Public image URL
- target_language_codes (optional): List of language codes

### Response

```json
{
  "translations": {
    "en": "English alt text...",
    "nl": "...",
    "de": "..."
  }
}
```

## Local Run

1. Install dependencies (Azure Functions Core Tools + Python).
2. Create a virtual environment in Azure-Function/ and install requirements.
3. Set environment variables in Azure-Function/local.settings.json.
4. Start the host:

```powershell
cd Azure-Function
func host start
```

## Configuration

Required app settings:
- ENDPOINT_URL
- DEPLOYMENT_NAME
- API_VERSION

Optional:
- ALT_TEXT_PROMPT_PATH (path to system_prompt.txt). If not set, the function reads the file next to function_app.py.

## Notes

- Authentication uses DefaultAzureCredential. In Azure, attach a managed identity and set AZURE_CLIENT_ID for a user-assigned identity.
- The Azure Functions app uses the new Python programming model (function_app.py).
