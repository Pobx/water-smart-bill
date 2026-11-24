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

REM 2) รันของใหม่ ^(build ใหม่^)
echo [*] กำลัง build และสตาร์ท ครั้งแรกอาจใช้เวลาหลายนาที...
%COMPOSE% up -d --build
if errorlevel 1 goto :fail

REM 3) ตรวจ/seed ฐานข้อมูล: backend จะทำเองตอนสตาร์ท
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
