@echo off
chcp 65001 > nul
REM Water Smart Bill - run full stack with Docker Compose
REM Usage: docker-up.bat [up|down|logs|reset]   (default: up)
cd /d "%~dp0"
set ACTION=%1
if "%ACTION%"=="" set ACTION=up

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ไม่พบ Docker Compose กรุณาติดตั้ง Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker ยังไม่ได้เปิดใช้งาน กรุณาเปิด Docker Desktop แล้วลองใหม่
    pause
    exit /b 1
)

set COMPOSE=docker compose -f deploy/docker-compose.yml
if "%ACTION%"=="up" (
    echo กำลัง build และสตาร์ททุกเซอร์วิส ครั้งแรกอาจใช้เวลาหลายนาที...
    %COMPOSE% up -d --build
    if errorlevel 1 (
        pause
        exit /b 1
    )
    echo ระบบพร้อมใช้งาน!
    echo เว็บแอป Gateway: http://localhost
    echo Backend API:     http://localhost:8080
    echo Swagger:         http://localhost:8080/swagger/index.html
    echo Keycloak Admin:  http://localhost:8081 ^(admin / admin^)
    echo หยุดระบบ: docker-up.bat down  ^|  ดู log: docker-up.bat logs
) else if "%ACTION%"=="down" (
    %COMPOSE% down
) else if "%ACTION%"=="logs" (
    %COMPOSE% logs -f --tail=100
) else if "%ACTION%"=="reset" (
    echo ลบข้อมูลฐานข้อมูลทั้งหมด
    %COMPOSE% down -v
) else (
    echo Usage: docker-up.bat [up^|down^|logs^|reset]
)
