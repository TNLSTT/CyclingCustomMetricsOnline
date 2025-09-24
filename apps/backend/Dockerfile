FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/package.json

RUN pnpm install --frozen-lockfile --filter backend...

COPY apps/backend apps/backend

RUN pnpm --filter backend prisma generate
RUN pnpm --filter backend build

ENV NODE_ENV=production
ENV PORT=4000

CMD ["pnpm", "--filter", "backend", "start"]
