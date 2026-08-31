# syntax=docker/dockerfile:1

# ---- Stage 1: frontend -------------------------------------------------------
# The image must contain the real frontend. A fallback shell would turn a
# failed frontend build into a misleadingly healthy production deployment.
FROM node:24-alpine3.24 AS web-build
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/package.json
RUN set -eux; \
    corepack enable; \
    pnpm install --frozen-lockfile --filter set-and-signal-web...
COPY web/ web/
RUN set -eux; \
    pnpm --dir web run build; \
    test -s web/dist/index.html

# ---- Stage 2: Go backend -----------------------------------------------------
FROM golang:1.27-alpine3.24 AS api-build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY web/embed.go web/
COPY --from=web-build /workspace/web/dist web/dist/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /opengym-api ./cmd/opengym-api

# ---- Stage 3: runtime --------------------------------------------------------
FROM alpine:3.24
RUN apk add --no-cache ca-certificates tzdata
COPY --from=api-build /opengym-api /opengym-api
ENV DATA_DIR=/data \
    RP_NAME="Set & Signal"
EXPOSE 3000
ENTRYPOINT ["/opengym-api"]
