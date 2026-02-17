import json
import logging
import os
from typing import List

import requests as http_requests
from flask import Flask, request, jsonify
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

app = Flask(__name__)

LANGUAGE_NAMES = {
    "nl": "Dutch",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
    "ja": "Japanese",
    "zh": "Simplified Chinese",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "hi": "Hindi",
}

# -- Azure Translator config --
TRANSLATOR_ENDPOINT = os.getenv(
    "TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com/"
)
TRANSLATOR_REGION = os.getenv("TRANSLATOR_REGION", "")
TRANSLATOR_RESOURCE_ID = os.getenv("TRANSLATOR_RESOURCE_ID", "")


def _read_system_prompt() -> str:
    prompt_path = os.getenv("ALT_TEXT_PROMPT_PATH")
    if not prompt_path:
        prompt_path = os.path.join(os.path.dirname(__file__), "system_prompt.txt")

    with open(prompt_path, "r", encoding="utf-8") as handle:
        return handle.read().strip()


def _build_client() -> AzureOpenAI:
    endpoint = os.getenv("ENDPOINT_URL")
    deployment = os.getenv("DEPLOYMENT_NAME")
    api_version = os.getenv("API_VERSION")

    missing = [name for name, value in {
        "ENDPOINT_URL": endpoint,
        "DEPLOYMENT_NAME": deployment,
        "API_VERSION": api_version,
    }.items() if not value]
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )

    return AzureOpenAI(
        azure_endpoint=endpoint,
        azure_ad_token_provider=token_provider,
        api_version=api_version,
    )


SYSTEM_PROMPT = _read_system_prompt()
CLIENT = _build_client()
DEPLOYMENT = os.getenv("DEPLOYMENT_NAME")


def generate_alt_text(image_url: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Describe the image in one sentence. Keep it concise and relevant to product.",
                },
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        },
    ]
    completion = CLIENT.chat.completions.create(
        model=DEPLOYMENT,
        messages=messages,
        max_tokens=120,
    )
    return completion.choices[0].message.content


def _get_translator_token() -> str:
    """Get a bearer token for Azure Translator using managed identity."""
    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")
    return token.token


def translate_alt_text(text: str, target_codes: List[str]) -> dict:
    """Translate text into multiple languages in a single Azure Translator call."""
    url = TRANSLATOR_ENDPOINT.rstrip("/") + "/translate"

    params = {
        "api-version": "3.0",
        "from": "en",
        "to": target_codes,
    }

    token = _get_translator_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Ocp-Apim-ResourceId": TRANSLATOR_RESOURCE_ID,
        "Ocp-Apim-Subscription-Region": TRANSLATOR_REGION,
        "Content-Type": "application/json",
    }

    body = [{"text": text}]

    response = http_requests.post(
        url, params=params, headers=headers, json=body, timeout=30
    )
    response.raise_for_status()

    result = response.json()
    translations = {}
    for item in result[0].get("translations", []):
        translations[item["to"]] = item["text"]
    return translations


def _parse_language_codes(raw_codes) -> List[str]:
    if raw_codes is None:
        return []
    if not isinstance(raw_codes, list):
        raise ValueError("target_language_codes must be a list of language codes")
    return [str(code).strip() for code in raw_codes if str(code).strip()]


@app.route("/alt-translate", methods=["POST"])
def alt_translate():
    logging.info("Processing alt-translate request.")

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON payload."}), 400

    image_url = payload.get("image_url") if isinstance(payload, dict) else None
    if not image_url:
        return jsonify({"error": "Missing required field: image_url."}), 400

    try:
        target_language_codes = _parse_language_codes(payload.get("target_language_codes"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        alt_text_en = generate_alt_text(image_url)
        translations = {"en": alt_text_en}

        codes_to_translate = [c for c in target_language_codes if c.lower() != "en"]
        if codes_to_translate:
            translated = translate_alt_text(alt_text_en, codes_to_translate)
            translations.update(translated)

        return jsonify({"translations": translations}), 200
    except Exception as exc:
        logging.exception("Alt-text generation failed.")
        return jsonify({"error": f"Alt-text generation failed: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)