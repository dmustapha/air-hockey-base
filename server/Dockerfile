# Air Hockey Server with Linera Blockchain (Conway Testnet)
# Build time: ~10-15 minutes for Rust compilation

# =============================================================================
# Stage 1: Build Linera CLI (Conway testnet v0.15.x)
# =============================================================================
FROM rust:1.86-bookworm AS linera-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    clang \
    && rm -rf /var/lib/apt/lists/*

# Install Linera CLI from crates.io (Conway testnet compatible)
# CARGO_HOME in rust docker image = /usr/local/cargo
RUN cargo install --locked linera-service@0.15.8

# Verify installation (correct path for rust docker image!)
RUN ls -la /usr/local/cargo/bin/ && /usr/local/cargo/bin/linera --version

# =============================================================================
# Stage 2: Build Node.js application
# =============================================================================
FROM node:20-bookworm-slim AS node-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# =============================================================================
# Stage 3: Production runtime
# =============================================================================
FROM node:20-bookworm-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Linera binary from builder (correct path!)
COPY --from=linera-builder /usr/local/cargo/bin/linera /usr/local/bin/linera

# Verify linera is available
RUN chmod +x /usr/local/bin/linera && linera --version

# Copy Node.js application
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package*.json ./

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Environment
ENV NODE_ENV=production
# NOTE: Railway sets PORT dynamically - do NOT hardcode it here
# The default 3001 is only used for local development

EXPOSE 3001

# Health check uses the PORT environment variable (Railway sets this dynamically)
# The shell form allows variable expansion at runtime
HEALTHCHECK --interval=30s --timeout=30s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Use startup script that initializes wallet before starting server
CMD ["/app/start.sh"]
