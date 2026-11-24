#!/usr/bin/env bash
# Water Smart Bill — run full stack with Docker Compose
# Usage: ./docker-up.sh [up|down|logs|reset|rebuild]   (default: up)
set -e
cd "$(dirname "$0")"
COMPOSE="docker compose -f deploy/docker-compose.yml"

if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null; then
  echo "[X] ไม่พบ Docker / Docker Compose กรุณาติดตั้ง Docker Desktop: https://www.docker.com/products/docker-desktop"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "[X] Docker ยังไม่ได้เปิดใช้งาน กรุณาเปิด Docker Desktop แล้วลองใหม่"
  exit 1
fi

fix_eol() {
  echo "[*] ซ่อม line ending ของ script ใน container (CRLF -> LF)"
  for f in frontend-react/docker/*.sh deploy/postgres/init/*.sh; do
    [ -f "$f" ] && sed -i.bak 's/\r$//' "$f" && rm -f "$f.bak"
  done
  return 0
}

do_up() {
  fix_eol
  # 1) เคยรัน docker compose มาก่อนหรือไม่
  if [ -n "$($COMPOSE ps -a -q 2>/dev/null)" ]; then
    echo "[*] พบการรันเดิม: ลบ container เดิมก่อน (เก็บข้อมูลฐานข้อมูลไว้ใน volume)"
    $COMPOSE down --remove-orphans
  else
    echo "[*] ยังไม่เคยรัน: เริ่มต้นใหม่"
  fi
  # 2) สตาร์ท postgres ก่อนและสร้างฐานข้อมูล keycloak อัตโนมัติถ้ายังไม่มี
  echo "[*] สตาร์ท postgres ก่อนเพื่อเตรียมฐานข้อมูล..."
  if ! $COMPOSE up -d postgres; then
    echo "[X] ไม่สามารถสตาร์ท postgres ได้ ดูรายละเอียดด้วย: ./docker-up.sh logs"
    exit 1
  fi
  PG_USER="${POSTGRES_USER:-water}"
  PG_DB="${POSTGRES_DB:-water_smart_bill}"
  KC_DB="${KEYCLOAK_DB:-keycloak}"
  echo "[*] รอ postgres พร้อมรับการเชื่อมต่อ..."
  PG_READY=0
  for _ in $(seq 1 30); do
    if docker exec water-postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1 && \
       docker exec water-postgres psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1" >/dev/null 2>&1; then
      PG_READY=1
      break
    fi
    sleep 2
  done
  if [ "$PG_READY" -ne 1 ]; then
    echo "[X] postgres ไม่พร้อมภายในเวลาที่กำหนด ดูรายละเอียดด้วย: ./docker-up.sh logs"
    exit 1
  fi
  echo "[*] ตรวจสอบ/สร้างฐานข้อมูล $KC_DB อัตโนมัติ..."
  if docker exec water-postgres psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1 FROM pg_database WHERE datname='$KC_DB'" | grep -q 1; then
    echo "    - ฐานข้อมูล $KC_DB มีอยู่แล้ว"
  else
    docker exec water-postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$KC_DB\";"
    echo "    - สร้างฐานข้อมูล $KC_DB สำเร็จ"
  fi
  # 3) รันของใหม่ทั้งหมด (build ใหม่)
  echo "[*] กำลัง build และสตาร์ทระบบทั้งหมด ครั้งแรกอาจใช้เวลาหลายนาที..."
  if ! $COMPOSE up -d --build; then
    echo "[X] เกิดข้อผิดพลาด ดูรายละเอียดด้วย: ./docker-up.sh logs"
    exit 1
  fi
  # 4) backend ตรวจ/seed ฐานข้อมูลเองตอนสตาร์ท:
  #    DB ว่าง = สร้าง schema + seed | schema/seed เปลี่ยน = apply ใหม่ | เท่าเดิม = ไม่ทำอะไร
  echo "[*] รอ backend ตรวจสอบฐานข้อมูล..."
  sleep 8
  echo "------ สถานะฐานข้อมูล (migration log) ------"
  docker logs water-backend 2>&1 | grep -iE "migration|PostgreSQL" || true
  echo "----------------------------------------------"
  echo
  echo "[OK] ระบบพร้อมใช้งาน"
  echo "  เว็บแอป (Gateway): http://localhost"
  echo "  Backend API:       http://localhost:8080"
  echo "  Swagger:           http://localhost:8080/swagger/index.html"
  echo "  Keycloak Admin:    http://localhost:8081 (admin / admin)"
  echo "  หยุดระบบ: ./docker-up.sh down   ดู log: ./docker-up.sh logs"
}

case "${1:-up}" in
  up)      do_up ;;
  down)    $COMPOSE down ;;
  logs)    $COMPOSE logs -f --tail=100 ;;
  reset)   echo "[!] ลบ container และข้อมูลฐานข้อมูลทั้งหมด"; $COMPOSE down -v --remove-orphans ;;
  rebuild)
    fix_eol
    $COMPOSE down -v --remove-orphans
    $COMPOSE build --no-cache
    do_up
    ;;
  *) echo "Usage: $0 [up|down|logs|reset|rebuild]"; exit 1 ;;
esac
