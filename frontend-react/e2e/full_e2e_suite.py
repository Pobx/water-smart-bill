#!/usr/bin/env python3
"""
Full Browser E2E Test Suite for Water Smart Bill (Playwright + Chromium)
Tests every feature, every function, real getUserMedia Camera OCR, RBAC roles,
Finance Cashier Desk, Offline-First Sync, Bluetooth ESC/POS, LINE LIFF, and Mobile UI.
Captures PNG screenshots and WebM video clips as verifiable evidence.
"""

import json
import os
import struct
import sys
import time
import zlib
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:5173")
OUT_DIR = Path(os.environ.get("E2E_OUT_DIR", "docs/test-evidence/e2e")).resolve()
SCREENSHOT_DIR = OUT_DIR / "screenshots"
VIDEO_DIR = OUT_DIR / "videos"
FIXTURE_DIR = OUT_DIR / "fixtures"

SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
FIXTURE_DIR.mkdir(parents=True, exist_ok=True)


def create_minimal_png(path: Path, width: int = 64, height: int = 64, rgb=(14, 165, 233)):
    """Create a valid minimal PNG image for file upload tests."""
    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack("!I", len(data))
            + tag
            + data
            + struct.pack("!I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack("!IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def sign_in(page, username: str, password: str = "water1234"):
    page.get_by_label("ชื่อผู้ใช้").fill(username)
    page.get_by_label("รหัสผ่าน").fill(password)
    page.get_by_role("button", name="เข้าสู่ระบบ").click()
    expect(page.get_by_label("Left Sidebar")).to_be_visible(timeout=10000)


def sign_out(page):
    page.get_by_role("button", name="ออกจากระบบ").click()
    expect(page.get_by_label("ชื่อผู้ใช้")).to_be_visible(timeout=10000)


def run_suite():
    results = []
    console_errors = []
    page_errors = []

    # Prepare test image fixtures
    avatar_png = FIXTURE_DIR / "avatar_somchai.png"
    meter_low_png = FIXTURE_DIR / "meter_00095.png"
    meter_ok_png = FIXTURE_DIR / "meter_00158.png"
    evil_svg = FIXTURE_DIR / "evil.svg"
    create_minimal_png(avatar_png, rgb=(16, 185, 129))
    create_minimal_png(meter_low_png, rgb=(245, 158, 11))
    create_minimal_png(meter_ok_png, rgb=(2, 132, 199))
    evil_svg.write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

    def record_result(tc_id: str, title: str, fn):
        t0 = time.time()
        try:
            details = fn()
            elapsed = round(time.time() - t0, 2)
            results.append({
                "id": tc_id,
                "title": title,
                "status": "PASS",
                "duration_s": elapsed,
                "details": details,
            })
            print(f"[PASS] {tc_id}: {title} ({elapsed}s)")
        except Exception as exc:
            elapsed = round(time.time() - t0, 2)
            results.append({
                "id": tc_id,
                "title": title,
                "status": "FAIL",
                "duration_s": elapsed,
                "error": str(exc),
            })
            print(f"[FAIL] {tc_id}: {title} ({elapsed}s) -> {exc}", file=sys.stderr)
            raise

    with sync_playwright() as p:
        # Launch real Chromium with fake media stream so getUserMedia camera works headlessly
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--no-sandbox",
            ],
        )

        # --- Desktop E2E Context (with video recording) ---
        desktop_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            permissions=["camera"],
            accept_downloads=True,
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 720},
        )
        page = desktop_ctx.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # TC-01: Login Gate & Invalid Credentials
        def tc01():
            page.goto(BASE_URL, wait_until="networkidle")
            expect(page.get_by_role("heading", name="Water Smart Bill")).to_be_visible()
            page.get_by_label("ชื่อผู้ใช้").fill("admin_hsg")
            page.get_by_label("รหัสผ่าน").fill("wrong_password")
            page.get_by_role("button", name="เข้าสู่ระบบ").click()
            expect(page.get_by_role("alert")).to_be_visible()
            shot = SCREENSHOT_DIR / "01_login_gate_and_error.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-01", "Login Gate & Invalid Credentials Alert", tc01)

        # TC-02: Demo Account Quick-Fill & Admin Login
        def tc02():
            page.get_by_role("button", name="admin_hsg").click()
            expect(page.get_by_label("ชื่อผู้ใช้")).to_have_value("admin_hsg")
            page.get_by_role("button", name="เข้าสู่ระบบ").click()
            expect(page.get_by_label("Left Sidebar")).to_be_visible()
            for menu_label in [
                "1. ข้อมูล อบต.",
                "2. อัตราค่าน้ำ",
                "3. จดมิเตอร์",
                "4. การเงิน & รับชำระ",
                "5. LINE LIFF ลูกบ้าน",
            ]:
                expect(page.get_by_role("button", name=menu_label)).to_be_visible()
            shot = SCREENSHOT_DIR / "02_admin_dashboard_master_data.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-02", "Demo Quick-Fill & Admin RBAC Login", tc02)

        # TC-03: Feature 1 — Master Data (Org Info, Zone, Homeowner Default + Uploaded Avatar)
        def tc03():
            # Edit Org Name
            org_input = page.get_by_label("ชื่อ อบต.")
            org_input.fill("องค์การบริหารส่วนตำบลห้องแซง (ทดสอบ E2E)")
            expect(page.locator("header")).to_contain_text("องค์การบริหารส่วนตำบลห้องแซง (ทดสอบ E2E)")

            # Add Village Zone
            page.get_by_placeholder("ชื่อหมู่บ้าน (เช่น บ้านดอน)").fill("หมู่ที่ 3 บ้านดอนพัฒนา")
            page.get_by_placeholder("สายจดมิเตอร์ / คุ้ม").fill("สายจดที่ 3 (คุ้มดอน)")
            page.get_by_role("button", name="+ เพิ่มหมู่บ้าน").click()
            expect(page.get_by_text("หมู่ที่ 3 บ้านดอนพัฒนา").first).to_be_visible()

            # Add Homeowner #1 (Default Avatar)
            page.get_by_label("ชื่อเจ้าของบ้าน").fill("วิภา")
            page.get_by_label("นามสกุลเจ้าของบ้าน").fill("สุขใจ")
            page.get_by_label("บ้านเลขที่").fill("309/2")
            page.get_by_role("button", name="บันทึกเจ้าของบ้าน").click()
            expect(page.get_by_text("วิภา สุขใจ").first).to_be_visible()

            # Add Homeowner #2 (Uploaded Avatar)
            page.get_by_label("ชื่อเจ้าของบ้าน").fill("สมชาย")
            page.get_by_label("นามสกุลเจ้าของบ้าน").fill("รักน้ำ")
            page.get_by_label("บ้านเลขที่").fill("310/5")
            page.locator('input[type="file"][accept="image/*"]').set_input_files(str(avatar_png))
            page.wait_for_timeout(300)
            page.get_by_role("button", name="บันทึกเจ้าของบ้าน").click()
            expect(page.get_by_text("สมชาย รักน้ำ").first).to_be_visible()
            expect(page.get_by_text("Uploaded Photo").first).to_be_visible()

            shot = SCREENSHOT_DIR / "03_master_data_zones_homeowners.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-03", "Master Data: Org, Village Zone, Homeowner Default & Uploaded Avatar", tc03)

        # TC-04: Feature 2 — Tariffs & Meters
        def tc04():
            page.get_by_role("button", name="2. อัตราค่าน้ำ").click()
            expect(page.get_by_text("บันทึกข้อมูลหน่วยและอัตราค่าน้ำขั้นบันได")).to_be_visible()

            # Create new period
            page.get_by_placeholder("เช่น 12/2569").fill("12/2569")
            page.get_by_role("button", name="+ เปิดงวดบิล").click()

            # Register new meter
            page.get_by_placeholder("เช่น HSG-0003").fill("HSG-0003")
            page.get_by_role("button", name="บันทึก", exact=True).click()
            expect(page.get_by_text("HSG-0003").first).to_be_visible()

            shot = SCREENSHOT_DIR / "04_tariffs_and_meters.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-04", "Tariffs & Meters: Progressive Tiers, Period & Meter Registration", tc04)

        # TC-05: Feature 3 — Field Reader: Real Live Camera OCR (getUserMedia + video + canvas)
        def tc05():
            page.get_by_role("button", name="3. จดมิเตอร์").click()
            expect(page.get_by_text("บันทึกเลขมิเตอร์น้ำ (Offline-First)")).to_be_visible()

            # Toggle Offline -> Online -> Offline
            mode_btn = page.get_by_role("button", name="สลับโหมด:")
            mode_btn.click()
            expect(page.get_by_text("Online Connected")).to_be_visible()
            mode_btn.click()
            expect(page.get_by_text("Offline Mode")).to_be_visible()

            # Open REAL Camera via getUserMedia
            page.get_by_role("button", name="เปิดกล้องสแกนมิเตอร์").click()
            video = page.get_by_label("กล้องสแกนมิเตอร์น้ำ")
            expect(video).to_be_visible(timeout=5000)

            # Wait until live video stream is actually playing (readyState >= 2)
            page.wait_for_function(
                """() => {
                    const v = document.querySelector('video[aria-label="กล้องสแกนมิเตอร์น้ำ"]');
                    return v && v.srcObject && v.readyState >= 2 && v.videoWidth > 0;
                }""",
                timeout=8000,
            )
            video_dims = page.evaluate(
                """() => {
                    const v = document.querySelector('video[aria-label="กล้องสแกนมิเตอร์น้ำ"]');
                    return { width: v.videoWidth, height: v.videoHeight, readyState: v.readyState };
                }"""
            )
            shot_open = SCREENSHOT_DIR / "05a_camera_ocr_live_viewfinder.png"
            page.screenshot(path=str(shot_open), full_page=True)

            # Capture photo from live camera & run OCR
            page.get_by_role("button", name="ถ่ายภาพและอ่านเลข OCR").click()
            expect(page.get_by_alt_text("ภาพหน้าปัดมิเตอร์ที่ถ่าย")).to_be_visible(timeout=5000)
            expect(video).to_be_hidden(timeout=5000)
            expect(page.get_by_label("เลขมิเตอร์ครั้งนี้")).to_have_value("142")

            shot_cap = SCREENSHOT_DIR / "05b_camera_ocr_captured_result.png"
            page.screenshot(path=str(shot_cap), full_page=True)
            return {
                "video_stream": video_dims,
                "screenshots": [shot_open.name, shot_cap.name],
            }

        record_result("TC-05", "Field Reader: Live Camera Viewfinder (getUserMedia) + Canvas Capture OCR", tc05)

        # TC-06: Feature 3 — Photo Upload OCR + Security MIME Validation + Low-Reading Warning
        def tc06():
            upload_input = page.get_by_label("อัปโหลดรูปหน้าปัดมิเตอร์")

            # 1) Reject SVG upload (hunt-file-upload security check)
            upload_input.set_input_files(str(evil_svg))
            expect(page.get_by_role("alert")).to_contain_text("รองรับเฉพาะไฟล์ภาพ")

            # 2) Upload image with lower reading than previous (95 < 120) -> warning
            upload_input.set_input_files(str(meter_low_png))
            expect(page.get_by_label("เลขมิเตอร์ครั้งนี้")).to_have_value("95")
            expect(page.get_by_text("น้อยกว่าเลขครั้งก่อน")).to_be_visible()

            # 3) Upload valid image with higher reading (158 > 120)
            upload_input.set_input_files(str(meter_ok_png))
            expect(page.get_by_label("เลขมิเตอร์ครั้งนี้")).to_have_value("158")
            expect(page.get_by_alt_text("ภาพหน้าปัดมิเตอร์ที่ถ่าย")).to_be_visible()

            shot = SCREENSHOT_DIR / "06_field_reader_photo_upload_ocr.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-06", "Field Reader: Photo Upload OCR, SVG Block & Low-Reading Warning", tc06)

        # TC-07: Feature 3 — NumericInput Formatting, Record Reading, Bluetooth ESC/POS Modal & Offline Sync
        def tc07():
            # Verify NumericInput formatting rules: plain text input, 1,230, 0.10, 0, and block 01234 -> 1,234
            reading_input = page.get_by_label("เลขมิเตอร์ครั้งนี้")
            expect(reading_input).to_have_attribute("type", "text")
            reading_input.fill("")
            reading_input.type("1230")
            expect(reading_input).to_have_value("1,230")
            reading_input.fill("")
            reading_input.type("0.10")
            expect(reading_input).to_have_value("0.10")
            reading_input.fill("")
            reading_input.type("0")
            expect(reading_input).to_have_value("0")
            reading_input.fill("")
            reading_input.type("01234")
            expect(reading_input).to_have_value("1,234")
            # Restore to 158 for normal billing calculation
            reading_input.fill("")
            reading_input.type("158")
            expect(reading_input).to_have_value("158")

            page.get_by_role("button", name="บันทึกมิเตอร์ & พิมพ์บิล Bluetooth").click()
            dialog = page.get_by_role("dialog", name="Bluetooth ESC/POS Receipt")
            expect(dialog).to_be_visible()
            expect(dialog).to_contain_text("HSG-0001")

            # Send Bluetooth ESC/POS command
            page.get_by_role("button", name="ส่งคำสั่งพิมพ์ Bluetooth ทันที").click()
            expect(dialog).to_contain_text("ส่งชุดคำสั่ง ESC/POS")

            shot_bt = SCREENSHOT_DIR / "07a_bluetooth_escpos_receipt_modal.png"
            page.screenshot(path=str(shot_bt), full_page=True)

            # Close modal & verify Offline Queue -> Sync
            page.get_by_role("button", name="ปิดหน้าต่าง").click()
            expect(dialog).to_be_hidden()
            expect(page.get_by_text("Pending Offline").first).to_be_visible()

            page.get_by_role("button", name="Sync ข้อมูลขึ้น Server").click()
            expect(page.get_by_text("Synced").first).to_be_visible()

            shot_sync = SCREENSHOT_DIR / "07b_offline_queue_synced.png"
            page.screenshot(path=str(shot_sync), full_page=True)
            return {"screenshots": [shot_bt.name, shot_sync.name]}

        record_result("TC-07", "Field Reader: NumericInput Format, Bluetooth ESC/POS & Offline Sync", tc07)

        # TC-08: Feature 4 — Finance & Cashier Desk (Filter, Search, Payment, Change, Receipt, CSV)
        def tc08():
            page.get_by_role("button", name="4. การเงิน & รับชำระ").click()
            expect(page.get_by_text("ระบบการเงินและรับชำระค่าน้ำ")).to_be_visible()

            # Filter unpaid & search
            page.get_by_role("button", name="รอชำระ").click()
            page.get_by_placeholder("ค้นหาเลขที่บิล").fill("สมหมาย")
            expect(page.get_by_text("นายสมหมาย ใจดี").first).to_be_visible()

            # Open Payment Modal
            page.get_by_role("button", name="รับชำระเงิน").first.click()
            expect(page.get_by_text("รับชำระค่าน้ำประปา")).to_be_visible()

            # Test insufficient cash
            cash_input = page.get_by_placeholder("0.00")
            expect(cash_input).to_have_attribute("type", "text")
            cash_input.fill("")
            cash_input.type("10")
            expect(page.get_by_text("ยอดเงินไม่เพียงพอ")).to_be_visible()
            expect(page.get_by_role("button", name="ยืนยันรับชำระเงิน")).to_be_disabled()

            # Test 4-digit formatted cash (1,000 THB)
            cash_input.fill("")
            cash_input.type("1000")
            expect(cash_input).to_have_value("1,000")
            expect(page.get_by_text("เงินทอน (Change):")).to_be_visible()
            expect(page.get_by_role("button", name="ยืนยันรับชำระเงิน")).to_be_enabled()

            shot_pay = SCREENSHOT_DIR / "08a_cashier_payment_modal.png"
            page.screenshot(path=str(shot_pay), full_page=True)

            # Confirm payment -> Official Receipt Modal
            page.get_by_role("button", name="ยืนยันรับชำระเงิน").click()
            expect(page.get_by_text("ใบเสร็จรับเงินค่าน้ำประปา").first).to_be_visible()
            expect(page.get_by_text("ชำระเงินเรียบร้อยแล้ว")).to_be_visible()

            shot_rc = SCREENSHOT_DIR / "08b_cashier_official_receipt.png"
            page.screenshot(path=str(shot_rc), full_page=True)

            page.get_by_role("button", name="ปิด", exact=True).click()

            # Export CSV
            with page.expect_download(timeout=5000) as dl_info:
                page.get_by_role("button", name="ส่งออกรายงาน CSV").click()
            dl = dl_info.value
            return {
                "csv_filename": dl.suggested_filename,
                "screenshots": [shot_pay.name, shot_rc.name],
            }

        record_result("TC-08", "Finance & Cashier Desk: Formatted Cash, Change, Receipt & CSV", tc08)

        # TC-09: Feature 5 — LINE LIFF Resident Portal (with SearchableSelect)
        def tc09():
            page.get_by_role("button", name="5. LINE LIFF ลูกบ้าน").click()
            expect(page.get_by_text("LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน")).to_be_visible()
            combobox = page.get_by_role("combobox", name="เลือกมิเตอร์ลูกบ้าน")
            expect(combobox).to_be_visible()
            combobox.click()
            combobox.fill("HSG-0002")
            page.get_by_role("option", name="HSG-0002").click()
            expect(page.get_by_text("นางมาลี ศรีสุข").first).to_be_visible()
            expect(page.get_by_text("ยอดรวมสุทธิ").first).to_be_visible()

            shot = SCREENSHOT_DIR / "09_line_liff_resident_portal.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-09", "LINE LIFF Resident Portal: SearchableSelect & Bill History", tc09)

        # TC-10: RBAC Role Isolation Across All 4 Roles + Logout
        def tc10():
            # Logout admin
            sign_out(page)
            expect(page.get_by_role("status")).to_be_visible()

            # Field reader (tabwater_staff)
            sign_in(page, "somchai_staff")
            expect(page.get_by_role("button", name="3. จดมิเตอร์")).to_be_visible()
            expect(page.get_by_role("button", name="1. ข้อมูล อบต.")).to_have_count(0)
            expect(page.get_by_role("button", name="4. การเงิน & รับชำระ")).to_have_count(0)
            sign_out(page)

            # Finance staff (finance_staff)
            sign_in(page, "finance_naree")
            expect(page.get_by_role("button", name="4. การเงิน & รับชำระ")).to_be_visible()
            expect(page.get_by_role("button", name="3. จดมิเตอร์")).to_have_count(0)
            sign_out(page)

            # Resident citizen (user)
            sign_in(page, "resident_sommai")
            expect(page.get_by_role("button", name="5. LINE LIFF ลูกบ้าน")).to_be_visible()
            expect(page.get_by_role("button", name="1. ข้อมูล อบต.")).to_have_count(0)
            expect(page.get_by_role("button", name="3. จดมิเตอร์")).to_have_count(0)
            expect(page.get_by_role("button", name="4. การเงิน & รับชำระ")).to_have_count(0)

            shot = SCREENSHOT_DIR / "10_rbac_resident_isolated_view.png"
            page.screenshot(path=str(shot), full_page=True)
            return {"screenshot": str(shot.name)}

        record_result("TC-10", "RBAC Isolation & Logout Across All 4 Roles", tc10)

        # Close desktop context to finalize video file
        desktop_video_path = page.video.path()
        desktop_ctx.close()
        final_desktop_video = VIDEO_DIR / "e2e_desktop_full_walkthrough.webm"
        if Path(desktop_video_path).exists():
            Path(desktop_video_path).replace(final_desktop_video)

        # --- Mobile Responsive Context (390x844 + video recording) ---
        mobile_ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            permissions=["camera"],
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 390, "height": 844},
        )
        m_page = mobile_ctx.new_page()
        m_page.on("pageerror", lambda err: page_errors.append(str(err)))

        def tc11():
            m_page.goto(BASE_URL, wait_until="networkidle")
            sign_in(m_page, "somchai_staff")
            m_page.get_by_label("เปิดเมนูนำทาง").click()
            m_page.get_by_role("button", name="3. จดมิเตอร์").click()
            m_page.get_by_role("button", name="เปิดกล้องสแกนมิเตอร์").click()
            expect(m_page.get_by_label("กล้องสแกนมิเตอร์น้ำ")).to_be_visible(timeout=5000)
            m_page.wait_for_function(
                """() => {
                    const v = document.querySelector('video[aria-label="กล้องสแกนมิเตอร์น้ำ"]');
                    return v && v.srcObject && v.readyState >= 2;
                }""",
                timeout=8000,
            )
            shot = SCREENSHOT_DIR / "11_mobile_camera_ocr_view.png"
            m_page.screenshot(path=str(shot), full_page=True)
            m_page.get_by_role("button", name="ถ่ายภาพและอ่านเลข OCR").click()
            expect(m_page.get_by_alt_text("ภาพหน้าปัดมิเตอร์ที่ถ่าย")).to_be_visible(timeout=5000)
            return {"screenshot": str(shot.name)}

        record_result("TC-11", "Mobile Responsive Drawer & Field Reader Camera OCR (390x844)", tc11)

        mobile_video_path = m_page.video.path()
        mobile_ctx.close()
        final_mobile_video = VIDEO_DIR / "e2e_mobile_camera_ocr.webm"
        if Path(mobile_video_path).exists():
            Path(mobile_video_path).replace(final_mobile_video)

        browser.close()

    report = {
        "base_url": BASE_URL,
        "total": len(results),
        "passed": sum(1 for r in results if r["status"] == "PASS"),
        "failed": sum(1 for r in results if r["status"] == "FAIL"),
        "console_errors": console_errors,
        "page_errors": page_errors,
        "videos": [
            str((VIDEO_DIR / "e2e_desktop_full_walkthrough.webm").name),
            str((VIDEO_DIR / "e2e_mobile_camera_ocr.webm").name),
        ],
        "results": results,
    }
    report_path = OUT_DIR / "e2e_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nE2E Report written to: {report_path}")
    print(f"Summary: {report['passed']}/{report['total']} PASSED, page_errors={len(page_errors)}")
    if report["failed"] > 0 or len(page_errors) > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_suite()
