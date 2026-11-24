#!/usr/bin/env bash
set -e

echo "=================================================="
echo "💧 Water Smart Bill — Local Development Starter"
echo "=================================================="

# Check if Docker is available
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  echo "🐳 ตรวจพบ Docker: คุณต้องการรันแบบครบทั้งระบบ (Docker) หรือรันเฉพาะ Frontend?"
  echo "1) รันเฉพาะ Frontend React (ง่ายและเร็วที่สุด - แนะนำ)"
  echo "2) รันครบทั้งระบบผ่าน Docker (Keycloak + Postgres + Redis + Go API + Frontend)"
  read -p "กรุณาเลือก [1 หรือ 2] (ค่าเริ่มต้น 1): " choice
  choice=${choice:-1}

  if [ "$choice" = "2" ]; then
    echo "🚀 กำลังสตาร์ททุกเซอร์วิสผ่าน Docker Compose..."
    docker compose -f deploy/docker-compose.yml up -d --build
    echo "✅ ระบบพร้อมใช้งานแล้ว!"
    echo "👉 Web (Gateway): http://localhost"
    echo "👉 Backend API:  http://localhost:8080"
    echo "👉 Swagger Doc:  http://localhost:8080/swagger/index.html"
    exit 0
  fi
fi

# Run Frontend React directly
echo "🚀 กำลังเตรียมรัน Frontend React..."
cd "$(dirname "$0")/frontend-react"

if [ ! -d "node_modules" ]; then
  echo "📦 กำลังติดตั้ง node_modules (ทำเพียงครั้งแรก)..."
  npm install
fi

echo "✨ เริ่มต้นรันเซิร์ฟเวอร์ Frontend..."
echo "👉 เปิดเว็บบราวเซอร์ไปที่: http://localhost:5173"
npm run dev
