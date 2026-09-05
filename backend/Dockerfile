FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including sqlite3 and curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY tests/ ./tests/
COPY pytest.ini .

# Create persistent data directory
RUN mkdir -p /app/data/backups

ENV PORT=3011
ENV DATABASE_URL=sqlite:////app/data/invest.db
ENV PYTHONUNBUFFERED=1

EXPOSE 3011

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3011"]
