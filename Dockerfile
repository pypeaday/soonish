FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
ENV VIRTUAL_ENV /opt/app-env
ENV PATH "${VIRTUAL_ENV}/bin:$PATH"
ENV UV_VIRTUALENV ${VIRTUAL_ENV}


# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Create virtual environment
RUN mkdir -p ${VIRTUAL_ENV} && \
    uv venv ${VIRTUAL_ENV}

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN uv pip install -r requirements.txt -n

# Copy application code
COPY . .

# Install package in development mode
RUN uv pip install -e . -n

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["python", "/app/soonish/main.py"]
