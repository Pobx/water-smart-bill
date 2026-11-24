#!/usr/bin/env bash
# Water Smart Bill — run full stack with Docker Compose
# Usage: ./docker-up.sh [up|down|logs|reset]   (default: up)
set -e
cd "$(dirname "$0")"
COMPOSE="docker compose -f deploy/docker-compose.yml"

if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
  echo "❌ ไม่พบ Docker / Docker Compose กรุณาติดตั้ง Docker Desktop ก่อน: https://www.docker.com/products/docker-desktop"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "❌ Docker ยังไม่ได้เปิดใช้งาน กรุณาเปิด Docker Desktop แล้วลองใหม่"
  exit 1
fi

case "${1:-up}" in
  up)
    echo "🚀 กำลัง build และสตาร์ททุกเซอร์วิส (ครั้งแรกอาจใช้เวลาหลายนาที)..."
    $COMPOSE up -d --build
    echo "✅ ระบบพร้อมใช้งาน!"
    echo "👉 เว็บแอป (Gateway): http://localhost"
    echo "👉 Backend API:       http://localhost:8080"
    echo "👉 Swagger:           http://localhost:8080/swagger/index.html"
    echo "👉 Keycloak Admin:    http://localhost:8081 (admin / admin)"
    echo "หยุดระบบ: ./docker-up.sh down | ดู log: ./docker-up.sh logs"
    ;;
  down)  $COMPOSE down ;;
  logs)  $COMPOSE logs -f --tail=100 ;;
  reset) echo "⚠️ ลบข้อมูลฐานข้อมูลทั้งหมด"; $COMPOSE down -v ;;
  *) echo "Usage: $0 [up|down|logs|reset]"; exit 1 ;;
esac
