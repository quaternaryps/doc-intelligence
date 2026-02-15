FROM denoland/deno:latest

# Set working directory
WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json* deno.lock* ./

# Cache dependencies
RUN if [ -f deno.json ]; then deno cache --lock=deno.lock deps.ts || true; fi

# Copy application code
COPY . .

# Set permissions
RUN chmod -R 755 /app

# Expose port
EXPOSE 8000

# Default command
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
