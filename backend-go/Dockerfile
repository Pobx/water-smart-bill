FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/water-smart-bill-api ./cmd/api

FROM alpine:3.20
WORKDIR /app
RUN mkdir -p /data/uploads/avatars /data/uploads/meters
COPY --from=builder /out/water-smart-bill-api /app/water-smart-bill-api
COPY db/migrations /app/db/migrations
COPY api/openapi.yaml /app/api/openapi.yaml
ENV HTTP_ADDR=":8080" \
    APP_ENV="demo" \
    UPLOAD_DIR="/data/uploads" \
    MIGRATIONS_DIR="/app/db/migrations" \
    OPENAPI_PATH="/app/api/openapi.yaml"
EXPOSE 8080
ENTRYPOINT ["/app/water-smart-bill-api"]
