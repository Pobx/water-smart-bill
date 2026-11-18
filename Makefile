.PHONY: test test-backend test-frontend build up down

test: test-backend test-frontend

test-backend:
	cd backend-go && go test ./... -v

test-frontend:
	cd frontend-react && npm test

build:
	cd backend-go && go build -o /tmp/water-smart-bill-api ./cmd/api
	cd frontend-react && npm run build

up:
	docker compose -f deploy/docker-compose.yml up -d --build

down:
	docker compose -f deploy/docker-compose.yml down
