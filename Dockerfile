# Build stage
FROM oven/bun:1.2.22-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Run stage
FROM oven/bun:1.2.22-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3005
CMD ["bun", "run", "start", "--port", "3006"]
