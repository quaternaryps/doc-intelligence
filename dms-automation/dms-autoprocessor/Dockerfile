FROM denoland/deno:1.40.0

# Install ImageMagick as root first
USER root
RUN apt-get update && apt-get install -y \
    imagemagick \
    ghostscript \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Fix ImageMagick PDF policy
RUN if [ -f /etc/ImageMagick-6/policy.xml ]; then \
      sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml; \
    elif [ -f /etc/ImageMagick/policy.xml ]; then \
      sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick/policy.xml; \
    fi

# Set up app directory with correct permissions
WORKDIR /app
RUN chown -R deno:deno /app

# Switch to deno user
USER deno

# Copy application files
COPY --chown=deno:deno . .

# Don't cache during build - let runtime handle it
# This avoids permission issues

# Expose port
EXPOSE 8000

# Run with --no-lock to avoid lockfile issues
CMD ["deno", "run", "--allow-all", "--no-lock", "cron.ts"]
