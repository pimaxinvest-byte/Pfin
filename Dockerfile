### ── Stage 1: Build ──────────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o sa-dashboard .

### ── Stage 2: Run ────────────────────────────────────────────
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/sa-dashboard .

EXPOSE 8080
ENV NO_BROWSER=1

CMD ["./sa-dashboard"]
