# ------------------------------------------------------------
# env vars to be set in your server provider (Vercel, etc.)
# ------------------------------------------------------------
# APP_URL       (optional, defaults to https://classic.pokepc.net)
# DATABASE_URL
# DIRECT_DATABASE_URL
# SHADOW_DATABASE_URL
# EMAIL_DEFAULT_FROM
# RESEND_API_KEY
# NEXTAUTH_SECRET
# PATREON_APP_CLIENT_ID
# PATREON_APP_CLIENT_SECRET
# ------------------------------------------------------------
# Dockerfile is used for production deployment:
# -------------------
# Base Images
# -------------------
FROM node:24-trixie-slim AS node_base
ENV NODE_ENV=production
ENV APP_ENV=production
ENV EMAIL_PROVIDER=resend
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates openssh-client curl wget git unzip \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.com/install | bash -s "bun-v1.3.0"
RUN corepack enable
RUN corepack prepare pnpm --activate
RUN echo "HOME: $HOME"
RUN echo "NODE: $(node -v)"
RUN echo "PNPM: $(pnpm -v)"
RUN echo "BUN: $(bun -v)"

# -------------------
# Base Image for nginx server (better for serving static files)
# -------------------
FROM nginx:1.29-trixie AS nginx_base
ENV NODE_ENV=production
ENV APP_ENV=production
ENV EMAIL_PROVIDER=resend
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
COPY infrastructure/nginx.conf /etc/nginx/nginx.conf
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates openssh-client curl wget git unzip \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.com/install | bash -s "bun-v1.3.0"
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
RUN . ~/.bashrc && nvm install 24
RUN . ~/.bashrc && nvm use 24
RUN . ~/.bashrc && corepack enable
RUN . ~/.bashrc && corepack prepare pnpm --activate

# -------------------
# Install dependencies
# -------------------
FROM node_base AS app_deps
COPY package.json /webapp/package.json
COPY pnpm-lock.yaml /webapp/pnpm-lock.yaml
COPY src/prisma/schema.prisma /webapp/src/prisma/schema.prisma
WORKDIR /webapp
RUN --mount=type=cache,id=pnpm_store,target=/pnpm/store NODE_ENV=development pnpm install --frozen-lockfile

# -------------------
# Build app
# -------------------
FROM node_base AS app_build
WORKDIR /webapp
COPY . /webapp
COPY --from=app_deps /webapp/node_modules /webapp/node_modules
RUN pnpm run prepare
RUN pnpm run build

# -------------------
# Serve app (nginx and Next.js)
# -------------------
FROM nginx_base AS app_serve
WORKDIR /webapp
COPY . /webapp
COPY --from=app_build /webapp/node_modules /webapp/node_modules
COPY --from=app_build /webapp/.next /webapp/.next
RUN cp -r /webapp/.next/static /webapp/public/_next/static
RUN chmod +x /webapp/infrastructure/docker-entrypoint.sh
EXPOSE 4000
CMD ["/webapp/infrastructure/docker-entrypoint.sh"]
