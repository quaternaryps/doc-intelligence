FROM drupal:7-apache

# Install ImageMagick, Ghostscript, and build dependencies
RUN apt-get update && apt-get install -y \
    imagemagick \
    libmagickwand-dev \
    ghostscript \
    && pecl install imagick \
    && docker-php-ext-enable imagick \
    && rm -rf /var/lib/apt/lists/*

# Fix ImageMagick PDF security policy
RUN sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml

# Verify Imagick is enabled
RUN php -m | grep imagick

# Restart Apache to load extension
RUN service apache2 restart || true
