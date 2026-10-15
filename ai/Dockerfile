FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required by unstructured for PDF/DOCX parsing
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libmagic1 \
        poppler-utils \
        tesseract-ocr \
        libreoffice-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# HOST=:: listens on IPv6 too (needed on Railway's private network)
CMD ["sh", "-c", "exec uvicorn main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000}"]
