# Local Testing Guide

## Prerequisites

- Python 3.10+
- Azure CLI logged in (`az login`)
- Your user must have **Cognitive Services User** role on both the OpenAI and Translator resources

## 1. Set up environment

```bash
cd Azure-Container-Apps
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
pip install -r requirements.txt
```

## 2. Configure `.env`

Create a `.env` file in `Azure-Container-Apps/`:

```env
ENDPOINT_URL=<your-openai-endpoint>
DEPLOYMENT_NAME=<your-deployment>
API_VERSION=<your-api-version>
TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/
TRANSLATOR_REGION=<full-region-name>          # e.g. eastus2, NOT eus2
TRANSLATOR_RESOURCE_ID=<full-resource-id>     # /subscriptions/.../accounts/<name>
```

## 3. Load env vars and run

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

python -m flask --app alt_translate run --host 0.0.0.0 --port 8080
```

## 4. Test

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/alt-translate" `
  -ContentType "application/json" `
  -Body '{"image_url": "https://example.com/product.jpg", "target_language_codes": ["nl", "de", "fr"]}'
```

Expected response:

```json
{
  "translations": {
    "en": "A white inkjet printer with paper loaded in the tray.",
    "nl": "Een witte inkjetprinter met papier in de lade.",
    "de": "Ein weißer Tintenstrahldrucker mit Papier im Fach.",
    "fr": "Une imprimante à jet d'encre blanche avec du papier dans le bac."
  }
}
```
