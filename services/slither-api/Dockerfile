FROM python:3.11-slim

# System deps for Slither + solc-select
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install solc-select + solc version
RUN pip install --no-cache-dir solc-select \
 && solc-select install 0.8.20 \
 && solc-select use 0.8.20

# Install python deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY app ./app
WORKDIR /app/app

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
