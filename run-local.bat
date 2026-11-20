@echo off
chcp 65001 > nul
echo ==================================================
echo 💧 Water Smart Bill — Local Development Starter (Windows)
echo ==================================================

cd /d "%~dp0\frontend-react"

if not exist "node_modules\" (
    echo 📦 กำลังติดตั้ง node_modules (ทำเพียงครั้งแรก)...
    call npm install
)

echo 🚀 เริ่มต้นรันเซิร์ฟเวอร์ Frontend...
echo 👉 เปิดเว็บบราวเซอร์ไปที่: http://localhost:5173
call npm run dev
pause
