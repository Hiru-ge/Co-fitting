FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        default-libmysqlclient-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "python manage.py collectstatic --noinput && if [ \"${RUN_MIGRATIONS:-0}\" = \"1\" ]; then python manage.py migrate --noinput; fi && if [ \"${LOCAL_HTTPS:-0}\" = \"1\" ]; then exec gunicorn Co_fitting.wsgi:application --bind \"0.0.0.0:${PORT:-8443}\" --certfile \"${TLS_CERT_FILE:-/certs/cert.pem}\" --keyfile \"${TLS_KEY_FILE:-/certs/key.pem}\"; else exec gunicorn Co_fitting.wsgi:application --bind \"0.0.0.0:${PORT:-8080}\"; fi"]
