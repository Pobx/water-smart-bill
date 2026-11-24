@echo off
chcp 65001 > nul
setlocal
REM Water Smart Bill - run full stack with Docker Compose (Docker Desktop)
REM Usage: docker-up.bat [up^|down^|logs^|reset^|rebuild]   (default: up)
cd /d "%~dp0"
set ACTION=%1
if "%ACTION%"=="" set ACTION=up

docker compose version >nul 2>&1
if errorlevel 1 (
    echo [X] ไม่พบ Docker Compose กรุณาติดตั้ง Docker Desktop: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker ยังไม่ได้เปิดใช้งาน กรุณาเปิด Docker Desktop แล้วลองใหม่
    pause
    exit /b 1
)

set COMPOSE=docker compose -f deploy/docker-compose.yml

if /i "%ACTION%"=="up" goto :up
if /i "%ACTION%"=="down" ( %COMPOSE% down & goto :end )
if /i "%ACTION%"=="logs" ( %COMPOSE% logs -f --tail=100 & goto :end )
if /i "%ACTION%"=="reset" (
    echo [!] ลบ container และข้อมูลฐานข้อมูลทั้งหมด
    %COMPOSE% down -v --remove-orphans
    goto :end
)
if /i "%ACTION%"=="rebuild" goto :rebuild
echo Usage: docker-up.bat [up^|down^|logs^|reset^|rebuild]
goto :end

:fixeol
echo [*] ซ่อม line ending ของ script ใน container (CRLF to LF)
powershell -NoProfile -Command "Get-ChildItem frontend-react/docker/*.sh,deploy/postgres/init/*.sh -ErrorAction SilentlyContinue | ForEach-Object { $c=[IO.File]::ReadAllText($_.FullName) -replace \"`r\",''; [IO.File]::WriteAllText($_.FullName,$c) }"
exit /b 0

:up
call :fixeol
REM 1) เคยรัน docker compose มาก่อนหรือไม่ (มี container เดิมของ project นี้)
set OLD=
for /f %%i in ('%COMPOSE% ps -a -q 2^>nul') do set OLD=1
if defined OLD (
    echo [*] พบการรันเดิม: ลบ container เดิมก่อน ^(เก็บข้อมูลฐานข้อมูลไว้ใน volume^)
    %COMPOSE% down --remove-orphans
    if errorlevel 1 goto :fail
) else (
    echo [*] ยังไม่เคยรัน: เริ่มต้นใหม่
)

REM 2) สตาร์ท postgres ก่อนและสร้างฐานข้อมูล keycloak อัตโนมัติถ้ายังไม่มี
echo [*] สตาร์ท postgres ก่อนเพื่อเตรียมฐานข้อมูล...
%COMPOSE% up -d postgres
if errorlevel 1 goto :fail

if not defined POSTGRES_USER set POSTGRES_USER=water
if not defined POSTGRES_DB set POSTGRES_DB=water_smart_bill
if not defined KEYCLOAK_DB set KEYCLOAK_DB=keycloak

echo [*] รอ postgres พร้อมรับการเชื่อมต่อ...
set PG_TRIES=0
:wait_pg
docker exec water-postgres pg_isready -U %POSTGRES_USER% -d %POSTGRES_DB% >nul 2>&1
if errorlevel 1 goto :wait_pg_retry
docker exec water-postgres psql -U %POSTGRES_USER% -d %POSTGRES_DB% -tAc "SELECT 1" >nul 2>&1
if not errorlevel 1 goto :pg_ready
:wait_pg_retry
set /a PG_TRIES+=1
if %PG_TRIES% GEQ 30 (
    echo [X] postgres ไม่พร้อมภายในเวลาที่กำหนด
    goto :fail
)
timeout /t 2 /nobreak >nul
goto :wait_pg

:pg_ready
echo [*] ตรวจสอบ/สร้างฐานข้อมูล %KEYCLOAK_DB% อัตโนมัติ...
set KC_EXISTS=
for /f %%i in ('docker exec water-postgres psql -U %POSTGRES_USER% -d %POSTGRES_DB% -tAc "SELECT 1 FROM pg_database WHERE datname='%KEYCLOAK_DB%'" 2^>nul') do set KC_EXISTS=%%i
if "%KC_EXISTS%"=="1" (
    echo     - ฐานข้อมูล %KEYCLOAK_DB% มีอยู่แล้ว
) else (
    docker exec water-postgres psql -U %POSTGRES_USER% -d %POSTGRES_DB% -v ON_ERROR_STOP=1 -c "CREATE DATABASE %KEYCLOAK_DB%;"
    if errorlevel 1 goto :fail
    echo     - สร้างฐานข้อมูล %KEYCLOAK_DB% สำเร็จ
)

REM 3) รันของใหม่ทั้งหมด ^(build ใหม่^)
echo [*] กำลัง build และสตาร์ทระบบทั้งหมด ครั้งแรกอาจใช้เวลาหลายนาที...
%COMPOSE% up -d --build
if errorlevel 1 goto :fail

REM 4) ตรวจ/seed ฐานข้อมูล: backend จะทำเองตอนสตาร์ท
REM    - DB ว่าง = สร้าง schema + seed data
REM    - schema/seed เปลี่ยน = apply ใหม่   - เท่าเดิม = ไม่ทำอะไร
echo [*] รอ backend ตรวจสอบฐานข้อมูล...
timeout /t 8 /nobreak >nul
echo ------ สถานะฐานข้อมูล ^(migration log^) ------
docker logs water-backend 2>&1 | findstr /i "migration PostgreSQL"
echo ----------------------------------------------
echo.
echo [OK] ระบบพร้อมใช้งาน
echo   เว็บแอป ^(Gateway^): http://localhost
echo   Backend API:       http://localhost:8080
echo   Swagger:           http://localhost:8080/swagger/index.html
echo   Keycloak Admin:    http://localhost:8081 ^(admin / admin^)
echo   หยุดระบบ: docker-up.bat down   ดู log: docker-up.bat logs
goto :end

:rebuild
call :fixeol
%COMPOSE% down -v --remove-orphans
%COMPOSE% build --no-cache
if errorlevel 1 goto :fail
goto :up

:fail
echo [X] เกิดข้อผิดพลาด ดูรายละเอียดด้วย: docker-up.bat logs
pause
exit /b 1

:end
endlocal
