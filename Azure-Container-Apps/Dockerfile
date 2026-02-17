FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

# CMD ["gunicorn", "--bind", "0.0.0.0:8080", "container_app:app"] This is for previous version of using SLM to translate text. Now we are using Azure Translator API, so the app file is alt_translate.py instead of container_app.py
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "alt_translate:app"]
