package rest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/adapters/blacklist"
	"github.com/pobx/water-smart-bill/backend-go/adapters/memory"
	"github.com/pobx/water-smart-bill/backend-go/adapters/web/rest"
	"github.com/pobx/water-smart-bill/backend-go/application"
	"github.com/pobx/water-smart-bill/backend-go/application/services"
)

type stubVerifier struct{}

func (stubVerifier) VerifyAccessToken(_ context.Context, rawToken string) (application.Claims, error) {
	orgID := int64(1)
	if rawToken == "valid-admin-token" {
		return application.Claims{
			JTI:       "jti-admin-token-1",
			Subject:   "sub-1",
			Username:  "admin_hsg",
			Roles:     []string{application.RoleAdmin, application.RoleTabwaterStaff, application.RoleFinanceStaff},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if rawToken == "valid-reader-token" {
		return application.Claims{
			JTI:       "jti-reader-token-1",
			Subject:   "sub-reader",
			Username:  "reader_somchai",
			Roles:     []string{application.RoleTabwaterStaff},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if rawToken == "valid-user-token" {
		return application.Claims{
			JTI:       "jti-user-token-1",
			Subject:   "sub-user",
			Username:  "user_sommai",
			Roles:     []string{application.RoleUser},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if rawToken == "valid-resident-1-token" {
		return application.Claims{
			JTI:       "jti-resident-1",
			Subject:   "demo-user-1",
			Username:  "sommai_01",
			Roles:     []string{application.RoleUser},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if rawToken == "valid-resident-2-token" {
		return application.Claims{
			JTI:       "jti-resident-2",
			Subject:   "demo-user-2",
			Username:  "malee_02",
			Roles:     []string{application.RoleUser},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if rawToken == "valid-superadmin-token" {
		return application.Claims{
			JTI:       "jti-superadmin-token-1",
			Subject:   "sub-superadmin",
			Username:  "super_admin",
			Roles:     []string{application.RoleSuperAdmin},
			OrgID:     nil,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	return application.Claims{}, application.ErrUnauthorized
}

func TestHTTPServerAuthLogoutBlacklistAndSwaggerGate(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")

	// 1. Non-prod server -> Swagger must be accessible
	devSrv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
		OpenAPISpec:  []byte("openapi: 3.0.3\ninfo:\n  title: Water Smart Bill API\n  version: 1.0.0\n"),
	})

	reqSwagger := httptest.NewRequest(http.MethodGet, "/swagger/index.html", nil)
	recSwagger := httptest.NewRecorder()
	devSrv.ServeHTTP(recSwagger, reqSwagger)
	if recSwagger.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for swagger in development, got %d", recSwagger.Code)
	}

	// 2. Prod server -> Swagger must be blocked (404)
	prodSrv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "production",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})
	reqProdSwagger := httptest.NewRequest(http.MethodGet, "/swagger/index.html", nil)
	recProdSwagger := httptest.NewRecorder()
	prodSrv.ServeHTTP(recProdSwagger, reqProdSwagger)
	if recProdSwagger.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for swagger in production, got %d", recProdSwagger.Code)
	}

	// 3. Authenticated call succeeds before logout
	reqMe := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqMe.Header.Set("Authorization", "Bearer valid-admin-token")
	recMe := httptest.NewRecorder()
	devSrv.ServeHTTP(recMe, reqMe)
	if recMe.Code != http.StatusOK {
		t.Fatalf("expected 200 OK before logout, got %d: %s", recMe.Code, recMe.Body.String())
	}

	// 4. Logout blacklists the JWT
	reqLogout := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer valid-admin-token")
	recLogout := httptest.NewRecorder()
	devSrv.ServeHTTP(recLogout, reqLogout)
	if recLogout.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on logout, got %d", recLogout.Code)
	}

	// 5. Subsequent call with blacklisted JWT must return 401 Unauthorized
	reqAfter := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqAfter.Header.Set("Authorization", "Bearer valid-admin-token")
	recAfter := httptest.NewRecorder()
	devSrv.ServeHTTP(recAfter, reqAfter)
	if recAfter.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized after JWT blacklisted, got %d", recAfter.Code)
	}
}

func TestHTTPServerWaterBillEndpoints(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "demo",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Default Avatar SVG
	reqAvatar := httptest.NewRequest(http.MethodGet, "/api/v1/avatars/default?name=สมหมาย", nil)
	recAvatar := httptest.NewRecorder()
	srv.ServeHTTP(recAvatar, reqAvatar)
	if recAvatar.Code != http.StatusOK || !strings.Contains(recAvatar.Body.String(), "<svg") {
		t.Fatalf("expected default avatar SVG, got %d", recAvatar.Code)
	}

	// OCR Meter Read
	ocrBody, _ := json.Marshal(map[string]any{
		"ocr_hint":   "READING 00145",
		"last_meter": 120,
	})
	reqOCR := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/ocr/meter-read", bytes.NewReader(ocrBody))
	reqOCR.Header.Set("Authorization", "Bearer valid-admin-token")
	reqOCR.Header.Set("Content-Type", "application/json")
	recOCR := httptest.NewRecorder()
	srv.ServeHTTP(recOCR, reqOCR)
	if recOCR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from OCR endpoint, got %d: %s", recOCR.Code, recOCR.Body.String())
	}

	// Offline Bundle
	reqBundle := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/offline-bundle", nil)
	reqBundle.Header.Set("Authorization", "Bearer valid-admin-token")
	recBundle := httptest.NewRecorder()
	srv.ServeHTTP(recBundle, reqBundle)
	if recBundle.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from offline-bundle, got %d", recBundle.Code)
	}

	// LINE LIFF Portal
	reqLiff := httptest.NewRequest(http.MethodGet, "/api/v1/liff/bills?meternumber=HSG-0001", nil)
	recLiff := httptest.NewRecorder()
	srv.ServeHTTP(recLiff, reqLiff)
	if recLiff.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from LIFF bills, got %d", recLiff.Code)
	}

	// Finance & Cashier Pay Invoice
	payBody, _ := json.Marshal(map[string]any{
		"payment_method": "cash",
	})
	reqPay := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/invoices/1/pay", bytes.NewReader(payBody))
	reqPay.Header.Set("Authorization", "Bearer valid-admin-token")
	reqPay.Header.Set("Content-Type", "application/json")
	recPay := httptest.NewRecorder()
	srv.ServeHTTP(recPay, reqPay)
	if recPay.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from pay invoice, got %d: %s", recPay.Code, recPay.Body.String())
	}

	// Finance & Cashier Collection Report (JSON)
	reqReport := httptest.NewRequest(http.MethodGet, "/api/v1/water-bills/reports/collections", nil)
	reqReport.Header.Set("Authorization", "Bearer valid-admin-token")
	recReport := httptest.NewRecorder()
	srv.ServeHTTP(recReport, reqReport)
	if recReport.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from collection report, got %d: %s", recReport.Code, recReport.Body.String())
	}

	// Finance & Cashier Collection Report (CSV)
	reqCSV := httptest.NewRequest(http.MethodGet, "/api/v1/water-bills/reports/collections?format=csv", nil)
	reqCSV.Header.Set("Authorization", "Bearer valid-admin-token")
	recCSV := httptest.NewRecorder()
	srv.ServeHTTP(recCSV, reqCSV)
	if recCSV.Code != http.StatusOK || !strings.Contains(recCSV.Body.String(), "เลขที่บิล") {
		t.Fatalf("expected 200 OK with CSV output, got %d: %s", recCSV.Code, recCSV.Body.String())
	}
}

func TestRequireRolesRBAC(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// 1. Staff Reader trying to access Admin-only Rate Config POST -> 403 Forbidden
	rateBody, _ := json.Marshal(map[string]any{
		"meter_type_name": "ครัวเรือนทั่วไป",
		"reserve_fee":     25.0,
		"vat":              7.0,
		"tiers": []map[string]any{
			{"tier_order": 1, "min_units": 0, "rate_per_unit": 5.0},
		},
	})
	reqRate := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/rate-configs", bytes.NewReader(rateBody))
	reqRate.Header.Set("Authorization", "Bearer valid-reader-token")
	reqRate.Header.Set("Content-Type", "application/json")
	recRate := httptest.NewRecorder()
	srv.ServeHTTP(recRate, reqRate)
	if recRate.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for reader calling rate config, got %d: %s", recRate.Code, recRate.Body.String())
	}
	if !strings.Contains(recRate.Body.String(), "insufficient role permissions") {
		t.Fatalf("expected 'insufficient role permissions' message, got %s", recRate.Body.String())
	}

	// 2. Staff Reader trying to access Finance-only Invoice Pay POST -> 403 Forbidden
	payBody, _ := json.Marshal(map[string]any{"payment_method": "cash"})
	reqPay := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/invoices/1/pay", bytes.NewReader(payBody))
	reqPay.Header.Set("Authorization", "Bearer valid-reader-token")
	reqPay.Header.Set("Content-Type", "application/json")
	recPay := httptest.NewRecorder()
	srv.ServeHTTP(recPay, reqPay)
	if recPay.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for reader calling pay invoice, got %d", recPay.Code)
	}

	// 3. Citizen (User role) trying to access Meter Reading POST -> 403 Forbidden
	readBody, _ := json.Marshal(map[string]any{
		"meter_id":        1,
		"period_id":       1,
		"current_reading": 120,
	})
	reqReadUser := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings", bytes.NewReader(readBody))
	reqReadUser.Header.Set("Authorization", "Bearer valid-user-token")
	reqReadUser.Header.Set("Content-Type", "application/json")
	recReadUser := httptest.NewRecorder()
	srv.ServeHTTP(recReadUser, reqReadUser)
	if recReadUser.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for citizen calling meter reading, got %d", recReadUser.Code)
	}

	// 4. Admin calling Admin-only Rate Config POST -> 200 OK (Allowed)
	reqAdminRate := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/rate-configs", bytes.NewReader(rateBody))
	reqAdminRate.Header.Set("Authorization", "Bearer valid-admin-token")
	reqAdminRate.Header.Set("Content-Type", "application/json")
	recAdminRate := httptest.NewRecorder()
	srv.ServeHTTP(recAdminRate, reqAdminRate)
	if recAdminRate.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin calling rate config, got %d: %s", recAdminRate.Code, recAdminRate.Body.String())
	}
}

func TestUploadHomeownerAvatarSecurityValidation(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// 1. Reject dangerous file upload (.html / .svg with script) -> 400 Bad Request
	var badBuf bytes.Buffer
	mwBad := multipart.NewWriter(&badBuf)
	fwBad, _ := mwBad.CreateFormFile("avatar", "exploit.html")
	_, _ = fwBad.Write([]byte("<script>alert(1)</script>"))
	_ = mwBad.Close()

	reqBadFile := httptest.NewRequest(http.MethodPost, "/api/v1/users/1/avatar", &badBuf)
	reqBadFile.Header.Set("Authorization", "Bearer valid-admin-token")
	reqBadFile.Header.Set("Content-Type", mwBad.FormDataContentType())
	recBadFile := httptest.NewRecorder()
	srv.ServeHTTP(recBadFile, reqBadFile)
	if recBadFile.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for .html avatar upload, got %d: %s", recBadFile.Code, recBadFile.Body.String())
	}

	// 2. Reject spoofed extension (.png with HTML payload) -> 400 Bad Request
	var spoofBuf bytes.Buffer
	mwSpoof := multipart.NewWriter(&spoofBuf)
	fwSpoof, _ := mwSpoof.CreateFormFile("avatar", "spoof.png")
	_, _ = fwSpoof.Write([]byte("<html><script>alert(1)</script></html>"))
	_ = mwSpoof.Close()

	reqSpoof := httptest.NewRequest(http.MethodPost, "/api/v1/users/1/avatar", &spoofBuf)
	reqSpoof.Header.Set("Authorization", "Bearer valid-admin-token")
	reqSpoof.Header.Set("Content-Type", mwSpoof.FormDataContentType())
	recSpoof := httptest.NewRecorder()
	srv.ServeHTTP(recSpoof, reqSpoof)
	if recSpoof.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for spoofed MIME .png upload, got %d: %s", recSpoof.Code, recSpoof.Body.String())
	}

	// 3. Reject dangerous javascript: URI in JSON avatar_url -> 400 Bad Request
	xssBody, _ := json.Marshal(map[string]string{"avatar_url": "javascript:alert(document.cookie)"})
	reqXSS := httptest.NewRequest(http.MethodPost, "/api/v1/users/1/avatar", bytes.NewReader(xssBody))
	reqXSS.Header.Set("Authorization", "Bearer valid-admin-token")
	reqXSS.Header.Set("Content-Type", "application/json")
	recXSS := httptest.NewRecorder()
	srv.ServeHTTP(recXSS, reqXSS)
	if recXSS.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for javascript: avatar_url, got %d: %s", recXSS.Code, recXSS.Body.String())
	}

	// 4. Accept valid PNG binary upload -> 200 OK
	validPNG := []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
		0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
		0x42, 0x60, 0x82,
	}
	var pngBuf bytes.Buffer
	mwPNG := multipart.NewWriter(&pngBuf)
	fwPNG, _ := mwPNG.CreateFormFile("avatar", "avatar.png")
	_, _ = fwPNG.Write(validPNG)
	_ = mwPNG.Close()

	reqPNG := httptest.NewRequest(http.MethodPost, "/api/v1/users/1/avatar", &pngBuf)
	reqPNG.Header.Set("Authorization", "Bearer valid-admin-token")
	reqPNG.Header.Set("Content-Type", mwPNG.FormDataContentType())
	recPNG := httptest.NewRecorder()
	srv.ServeHTTP(recPNG, reqPNG)
	if recPNG.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid PNG upload, got %d: %s", recPNG.Code, recPNG.Body.String())
	}
}

func TestRoleScopedDemoTokensRBAC(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:          "demo",
		AllowDemoTokens: true,
		Blacklist:       bl,
		WaterService:    svc,
		UploadDir:       t.TempDir(),
	})

	// 1. tabwater_staff demo token cannot access finance collection report (403 Forbidden)
	reqStaffFinance := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/reports/collections", nil)
	reqStaffFinance.Header.Set("Authorization", "Bearer demo-jwt-role-tabwater_staff-123")
	recStaffFinance := httptest.NewRecorder()
	srv.ServeHTTP(recStaffFinance, reqStaffFinance)
	if recStaffFinance.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for tabwater_staff accessing finance report, got %d: %s", recStaffFinance.Code, recStaffFinance.Body.String())
	}

	// 2. finance_staff demo token CAN access finance collection report (200 OK)
	reqFinanceOK := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/reports/collections", nil)
	reqFinanceOK.Header.Set("Authorization", "Bearer demo-jwt-role-finance_staff-123")
	recFinanceOK := httptest.NewRecorder()
	srv.ServeHTTP(recFinanceOK, reqFinanceOK)
	if recFinanceOK.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for finance_staff accessing finance report, got %d: %s", recFinanceOK.Code, recFinanceOK.Body.String())
	}

	// 3. user demo token cannot access finance collection report (403 Forbidden)
	reqUserFinance := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/reports/collections", nil)
	reqUserFinance.Header.Set("Authorization", "Bearer demo-jwt-role-user-123")
	recUserFinance := httptest.NewRecorder()
	srv.ServeHTTP(recUserFinance, reqUserFinance)
	if recUserFinance.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for user accessing finance report, got %d", recUserFinance.Code)
	}

	// 4. When AllowDemoTokens is false (prod), demo tokens must be rejected (401 Unauthorized)
	prodSrv := rest.NewServer(rest.ServerConfig{
		AppEnv:          "production",
		AllowDemoTokens: false,
		Verifier:        stubVerifier{},
		Blacklist:       bl,
		WaterService:    svc,
		UploadDir:       t.TempDir(),
	})
	reqProdDemo := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqProdDemo.Header.Set("Authorization", "Bearer demo-jwt-role-admin-123")
	recProdDemo := httptest.NewRecorder()
	prodSrv.ServeHTTP(recProdDemo, reqProdDemo)
	if recProdDemo.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for demo token when AllowDemoTokens=false, got %d", recProdDemo.Code)
	}
}

func TestGetMeterRoutes_StaffGetsOwnOrgRoutes(t *testing.T) {
	repo := memory.NewStore()
	staffID := int64(10)
	repo.SeedMeterRoutes(
		application.MeterRoute{ID: 1, OrgID: 1, Name: "สายที่ 1 (เหนือ)", StaffID: &staffID},
		application.MeterRoute{ID: 2, OrgID: 1, Name: "สายที่ 2 (ใต้)", StaffID: nil},
		application.MeterRoute{ID: 3, OrgID: 2, Name: "สายที่ 3 (อบต.อื่น)", StaffID: &staffID},
	)
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/meter-routes", nil)
	req.Header.Set("Authorization", "Bearer valid-reader-token")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Items []application.MeterRoute `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 routes for org 1, got %d: %+v", len(resp.Items), resp.Items)
	}
	for _, r := range resp.Items {
		if r.OrgID != 1 {
			t.Fatalf("expected only org_id=1 routes, got org_id=%d (%s)", r.OrgID, r.Name)
		}
	}

	// Cross-tenant query (?org_id=2) with org1 staff token must be rejected (403 Forbidden)
	reqCross := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/meter-routes?org_id=2", nil)
	reqCross.Header.Set("Authorization", "Bearer valid-reader-token")
	recCross := httptest.NewRecorder()
	srv.ServeHTTP(recCross, reqCross)
	if recCross.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for cross-org query, got %d: %s", recCross.Code, recCross.Body.String())
	}
}

func TestGetMeterRoutes_UnauthorizedRole(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/meter-routes", nil)
	req.Header.Set("Authorization", "Bearer valid-user-token")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for user role, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestListReadings_FilterByStatus(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	bl := blacklist.NewStore("")

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// 1. status=recorded for period_id=1 returns only meters with invoices in period 1 (HSG-0001)
	reqRec := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?period_id=1&status=recorded", nil)
	reqRec.Header.Set("Authorization", "Bearer valid-reader-token")
	recRec := httptest.NewRecorder()
	srv.ServeHTTP(recRec, reqRec)
	if recRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for recorded readings, got %d: %s", recRec.Code, recRec.Body.String())
	}

	var recResp struct {
		Items []struct {
			MeterID       int64    `json:"meter_id"`
			MeterNumber   string   `json:"meternumber"`
			OrgID         int64    `json:"org_id"`
			PeriodID      int64    `json:"period_id"`
			CurrentMeter  *float64 `json:"currentmeter"`
			ReadingStatus string   `json:"reading_status"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recRec.Body.Bytes(), &recResp); err != nil {
		t.Fatalf("failed to decode recorded response: %v", err)
	}
	if len(recResp.Items) != 1 {
		t.Fatalf("expected 1 recorded reading for period 1, got %d: %+v", len(recResp.Items), recResp.Items)
	}
	if recResp.Items[0].MeterNumber != "HSG-0001" || recResp.Items[0].ReadingStatus != "recorded" {
		t.Fatalf("expected HSG-0001 with status=recorded, got %+v", recResp.Items[0])
	}
	if recResp.Items[0].CurrentMeter == nil || *recResp.Items[0].CurrentMeter != 120 {
		t.Fatalf("expected currentmeter=120, got %+v", recResp.Items[0].CurrentMeter)
	}

	// 2. status=pending for period_id=1 returns only meters without invoices in period 1 (HSG-0002)
	reqPend := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?period_id=1&status=pending", nil)
	reqPend.Header.Set("Authorization", "Bearer valid-reader-token")
	recPend := httptest.NewRecorder()
	srv.ServeHTTP(recPend, reqPend)
	if recPend.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for pending readings, got %d: %s", recPend.Code, recPend.Body.String())
	}
	var pendResp struct {
		Items []struct {
			MeterID       int64    `json:"meter_id"`
			MeterNumber   string   `json:"meternumber"`
			CurrentMeter  *float64 `json:"currentmeter"`
			ReadingStatus string   `json:"reading_status"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recPend.Body.Bytes(), &pendResp); err != nil {
		t.Fatalf("failed to decode pending response: %v", err)
	}
	if len(pendResp.Items) != 1 {
		t.Fatalf("expected 1 pending reading for period 1, got %d: %+v", len(pendResp.Items), pendResp.Items)
	}
	if pendResp.Items[0].MeterNumber != "HSG-0002" || pendResp.Items[0].ReadingStatus != "pending" {
		t.Fatalf("expected HSG-0002 with status=pending, got %+v", pendResp.Items[0])
	}

	// 3. Invalid status parameter -> 400 Bad Request
	reqBadStatus := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?period_id=1&status=unknown", nil)
	reqBadStatus.Header.Set("Authorization", "Bearer valid-reader-token")
	recBadStatus := httptest.NewRecorder()
	srv.ServeHTTP(recBadStatus, reqBadStatus)
	if recBadStatus.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid status, got %d: %s", recBadStatus.Code, recBadStatus.Body.String())
	}

	// 4. Cross-tenant query (?org_id=2) with org1 staff token -> 403 Forbidden
	reqCrossOrg := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?period_id=1&org_id=2", nil)
	reqCrossOrg.Header.Set("Authorization", "Bearer valid-reader-token")
	recCrossOrg := httptest.NewRecorder()
	srv.ServeHTTP(recCrossOrg, reqCrossOrg)
	if recCrossOrg.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for cross-org readings query, got %d: %s", recCrossOrg.Code, recCrossOrg.Body.String())
	}

	// 5. Unauthorized role (citizen user) -> 403 Forbidden
	reqUnauth := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?period_id=1&status=recorded", nil)
	reqUnauth.Header.Set("Authorization", "Bearer valid-user-token")
	recUnauth := httptest.NewRecorder()
	srv.ServeHTTP(recUnauth, reqUnauth)
	if recUnauth.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for user role, got %d: %s", recUnauth.Code, recUnauth.Body.String())
	}

	// 6. Omitted period_id resolves to active period (period 1: 11/2569)
	reqDefaultPend := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/readings?status=pending", nil)
	reqDefaultPend.Header.Set("Authorization", "Bearer valid-reader-token")
	recDefaultPend := httptest.NewRecorder()
	srv.ServeHTTP(recDefaultPend, reqDefaultPend)
	if recDefaultPend.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for default-period pending readings, got %d: %s", recDefaultPend.Code, recDefaultPend.Body.String())
	}
	var defaultPendResp struct {
		Items []struct {
			MeterNumber   string `json:"meternumber"`
			PeriodID      int64  `json:"period_id"`
			ReadingStatus string `json:"reading_status"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recDefaultPend.Body.Bytes(), &defaultPendResp); err != nil {
		t.Fatalf("failed to decode default pending response: %v", err)
	}
	if len(defaultPendResp.Items) != 1 || defaultPendResp.Items[0].MeterNumber != "HSG-0002" || defaultPendResp.Items[0].PeriodID != 1 {
		t.Fatalf("expected 1 pending meter HSG-0002 for active period 1, got %+v", defaultPendResp.Items)
	}
}

func TestUpdateRateConfig_ValidTiers(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	payload := `{
		"vat": 7.5,
		"reserve_fee": 15,
		"tiers": [
			{"from": 11, "to": 50, "rate": 80},
			{"from": 0, "to": 10, "rate": 50}
		]
	}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/tabwater/rate-configs/1", strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid tier update, got %d: %s", rec.Code, rec.Body.String())
	}

	var updated application.MeterRateConfig
	if err := json.Unmarshal(rec.Body.Bytes(), &updated); err != nil {
		t.Fatalf("failed to decode updated rate config: %v", err)
	}
	if updated.VatPercent != 7.5 {
		t.Fatalf("expected vat=7.5, got %v", updated.VatPercent)
	}
	if updated.ReserveFee != 15 {
		t.Fatalf("expected reserve_fee=15, got %v", updated.ReserveFee)
	}
	if len(updated.Tiers) != 2 {
		t.Fatalf("expected 2 tiers, got %d", len(updated.Tiers))
	}
	// Verify tiers are sorted by min_units ascending and tier_order normalized
	if updated.Tiers[0].MinUnits != 0 || updated.Tiers[0].MaxUnits == nil || *updated.Tiers[0].MaxUnits != 10 || updated.Tiers[0].RatePerUnit != 50 || updated.Tiers[0].TierOrder != 1 {
		t.Fatalf("unexpected first tier: %+v", updated.Tiers[0])
	}
	if updated.Tiers[1].MinUnits != 11 || updated.Tiers[1].MaxUnits == nil || *updated.Tiers[1].MaxUnits != 50 || updated.Tiers[1].RatePerUnit != 80 || updated.Tiers[1].TierOrder != 2 {
		t.Fatalf("unexpected second tier: %+v", updated.Tiers[1])
	}
}

func TestUpdateRateConfig_GapInTiers(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	payload := `{
		"vat": 7,
		"reserve_fee": 10,
		"tiers": [
			{"from": 0, "to": 5, "rate": 5},
			{"from": 10, "to": 50, "rate": 8}
		]
	}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/tabwater/rate-configs/1", strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for tier gap, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "tier gap detected") {
		t.Fatalf("expected error detail to contain 'tier gap detected', got: %s", rec.Body.String())
	}
}

func TestUpdateRateConfig_OverlapInTiers(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	payload := `{
		"vat": 7,
		"reserve_fee": 10,
		"tiers": [
			{"min_units": 0, "max_units": 10, "rate_per_unit": 5},
			{"min_units": 10, "max_units": 50, "rate_per_unit": 8}
		]
	}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/tabwater/rate-configs/1", strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for tier overlap, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "tier overlap detected") {
		t.Fatalf("expected error detail to contain 'tier overlap detected', got: %s", rec.Body.String())
	}
}

func TestUpdateRateConfig_NonAdminForbidden(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	payload := `{
		"vat": 7,
		"reserve_fee": 10,
		"tiers": [
			{"from": 0, "to": 10, "rate": 5}
		]
	}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/tabwater/rate-configs/1", strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer valid-reader-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for staff role, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpdateRateConfig_FinalizedPeriodConflict(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Period 2 is seeded as status "closed" in memory.NewStore()
	payload := `{
		"period_id": 2,
		"vat": 7,
		"reserve_fee": 10,
		"tiers": [
			{"from": 0, "to": 10, "rate": 5}
		]
	}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/tabwater/rate-configs/1", strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for finalized period, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetOutstandingBalance_ReturnsUnpaidInvoices(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// User 1 already has 1 unpaid invoice (ID 1, TotalPaid 101.65) in memory.NewStore().
	// Record 2 more invoices for meter 1 (User 1), then pay 1 of them -> 3 total, 2 unpaid.
	createReading := func(invNo string, currentMeter float64) application.WaterInvoice {
		body, _ := json.Marshal(map[string]any{
			"inv_no":        invNo,
			"meter_id":      1,
			"period_id":     1,
			"current_meter": currentMeter,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer valid-admin-token")
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("failed to create reading %s: %d %s", invNo, rec.Code, rec.Body.String())
		}
		var inv application.WaterInvoice
		if err := json.Unmarshal(rec.Body.Bytes(), &inv); err != nil {
			t.Fatalf("decode invoice: %v", err)
		}
		return inv
	}

	invA := createReading("INV-OUT-001", 130)
	invB := createReading("INV-OUT-002", 140)

	// Pay invB so only invoice 1 and invA remain unpaid
	payReq := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/invoices/"+strconv.FormatInt(invB.ID, 10)+"/pay", strings.NewReader(`{"payment_method":"cash"}`))
	payReq.Header.Set("Authorization", "Bearer valid-admin-token")
	payReq.Header.Set("Content-Type", "application/json")
	payRec := httptest.NewRecorder()
	srv.ServeHTTP(payRec, payReq)
	if payRec.Code != http.StatusOK {
		t.Fatalf("failed to pay invoice %d: %d %s", invB.ID, payRec.Code, payRec.Body.String())
	}

	// Non-finance role must be forbidden
	reqForbidden := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/outstanding", nil)
	reqForbidden.Header.Set("Authorization", "Bearer valid-reader-token")
	recForbidden := httptest.NewRecorder()
	srv.ServeHTTP(recForbidden, reqForbidden)
	if recForbidden.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for non-finance role, got %d: %s", recForbidden.Code, recForbidden.Body.String())
	}

	// Finance/admin gets 2 unpaid invoices with accurate total
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/outstanding", nil)
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Invoices []application.WaterInvoice `json:"invoices"`
		Total    float64                    `json:"total"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode outstanding response: %v", err)
	}
	if len(resp.Invoices) != 2 {
		t.Fatalf("expected 2 unpaid invoices, got %d", len(resp.Invoices))
	}
	expectedTotal := 101.65 + invA.TotalPaid
	if diff := resp.Total - expectedTotal; diff < -0.01 || diff > 0.01 {
		t.Fatalf("expected total %.2f, got %.2f", expectedTotal, resp.Total)
	}
}

func TestPayInvoicesBulk_AtomicSuccess(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Create a second unpaid invoice for User 1 (meter 1)
	readBody, _ := json.Marshal(map[string]any{
		"inv_no":        "INV-BULK-001",
		"meter_id":      1,
		"period_id":     1,
		"current_meter": 135,
	})
	readReq := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings", bytes.NewReader(readBody))
	readReq.Header.Set("Authorization", "Bearer valid-admin-token")
	readReq.Header.Set("Content-Type", "application/json")
	readRec := httptest.NewRecorder()
	srv.ServeHTTP(readRec, readReq)
	if readRec.Code != http.StatusCreated {
		t.Fatalf("create reading failed: %d %s", readRec.Code, readRec.Body.String())
	}
	var inv2 application.WaterInvoice
	_ = json.Unmarshal(readRec.Body.Bytes(), &inv2)

	expectedSum := 101.65 + inv2.TotalPaid
	bulkBody, _ := json.Marshal(map[string]any{
		"user_id":        1,
		"invoice_ids":    []int64{1, inv2.ID},
		"amount":         expectedSum,
		"batch_id":       "11111111-1111-4111-8111-111111111111",
		"payment_method": "cash",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", bytes.NewReader(bulkBody))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for bulk payment, got %d: %s", rec.Code, rec.Body.String())
	}

	var result struct {
		BatchID     string                     `json:"batch_id"`
		TotalAmount float64                    `json:"total_amount"`
		ReceiptNo   string                     `json:"receipt_no"`
		Invoices    []application.WaterInvoice `json:"invoices"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode bulk result: %v", err)
	}
	if result.BatchID != "11111111-1111-4111-8111-111111111111" {
		t.Fatalf("unexpected batch_id: %s", result.BatchID)
	}
	if len(result.Invoices) != 2 {
		t.Fatalf("expected 2 paid invoices, got %d", len(result.Invoices))
	}
	for _, inv := range result.Invoices {
		if inv.Status != "paid" {
			t.Fatalf("expected invoice %d to be paid, got %s", inv.ID, inv.Status)
		}
	}
	if result.ReceiptNo == "" {
		t.Fatalf("expected consolidated receipt_no to be non-empty")
	}

	// Verify outstanding balance is now 0
	outReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/outstanding", nil)
	outReq.Header.Set("Authorization", "Bearer valid-admin-token")
	outRec := httptest.NewRecorder()
	srv.ServeHTTP(outRec, outReq)
	if outRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from outstanding after payment, got %d", outRec.Code)
	}
	var outResp struct {
		Invoices []application.WaterInvoice `json:"invoices"`
		Total    float64                    `json:"total"`
	}
	_ = json.Unmarshal(outRec.Body.Bytes(), &outResp)
	if len(outResp.Invoices) != 0 || outResp.Total != 0 {
		t.Fatalf("expected 0 unpaid invoices after bulk pay, got %d (total %.2f)", len(outResp.Invoices), outResp.Total)
	}
}

func TestPayInvoicesBulk_DuplicateBatchID(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	batchID := "22222222-2222-4222-8222-222222222222"
	bulkBody, _ := json.Marshal(map[string]any{
		"user_id":     1,
		"invoice_ids": []int64{1},
		"amount":      101.65,
		"batch_id":    batchID,
	})

	// First call succeeds
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", bytes.NewReader(bulkBody))
	req1.Header.Set("Authorization", "Bearer valid-admin-token")
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	srv.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("expected first bulk payment to succeed (200), got %d: %s", rec1.Code, rec1.Body.String())
	}

	// Second call with same batch_id must return 409 Conflict
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", bytes.NewReader(bulkBody))
	req2.Header.Set("Authorization", "Bearer valid-admin-token")
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	srv.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for duplicate batch_id, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestPayInvoicesBulk_PartialFailRollback(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Invoice 1 is valid & unpaid for user 1; invoice 99999 does not exist -> must rollback completely
	batchID := "33333333-3333-4333-8333-333333333333"
	bulkBody, _ := json.Marshal(map[string]any{
		"user_id":     1,
		"invoice_ids": []int64{1, 99999},
		"amount":      200.00,
		"batch_id":    batchID,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", bytes.NewReader(bulkBody))
	req.Header.Set("Authorization", "Bearer valid-admin-token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code == http.StatusOK {
		t.Fatalf("expected bulk payment with invalid second invoice to fail, got 200: %s", rec.Body.String())
	}

	// Verify invoice 1 is STILL unpaid (no partial mutation)
	outReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/outstanding", nil)
	outReq.Header.Set("Authorization", "Bearer valid-admin-token")
	outRec := httptest.NewRecorder()
	srv.ServeHTTP(outRec, outReq)
	if outRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from outstanding, got %d", outRec.Code)
	}
	var outResp struct {
		Invoices []application.WaterInvoice `json:"invoices"`
		Total    float64                    `json:"total"`
	}
	_ = json.Unmarshal(outRec.Body.Bytes(), &outResp)
	if len(outResp.Invoices) != 1 || outResp.Invoices[0].ID != 1 {
		t.Fatalf("expected invoice 1 to remain unpaid after rollback, got %+v", outResp.Invoices)
	}
}

func TestPayInvoicesBulk_ZeroOrUnderpaymentRejected(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	cases := []struct {
		name    string
		payload string
	}{
		{
			name:    "zero amount",
			payload: `{"user_id":1,"invoice_ids":[1],"amount":0,"batch_id":"55555555-5555-4555-8555-555555555551"}`,
		},
		{
			name:    "omitted amount",
			payload: `{"user_id":1,"invoice_ids":[1],"batch_id":"55555555-5555-4555-8555-555555555552"}`,
		},
		{
			name:    "underpayment amount",
			payload: `{"user_id":1,"invoice_ids":[1],"amount":50.00,"batch_id":"55555555-5555-4555-8555-555555555553"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", strings.NewReader(tc.payload))
			req.Header.Set("Authorization", "Bearer valid-admin-token")
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			srv.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400 Bad Request for %s, got %d: %s", tc.name, rec.Code, rec.Body.String())
			}
		})
	}

	// Invoice 1 must still be unpaid
	outReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/outstanding", nil)
	outReq.Header.Set("Authorization", "Bearer valid-admin-token")
	outRec := httptest.NewRecorder()
	srv.ServeHTTP(outRec, outReq)
	var outResp struct {
		Invoices []application.WaterInvoice `json:"invoices"`
	}
	_ = json.Unmarshal(outRec.Body.Bytes(), &outResp)
	if len(outResp.Invoices) != 1 || outResp.Invoices[0].ID != 1 {
		t.Fatalf("expected invoice 1 to remain unpaid, got %+v", outResp.Invoices)
	}
}

func TestPayInvoicesBulk_SuperAdminCrossOrg(t *testing.T) {
	repo := memory.NewStore()
	repo.SeedCrossOrgMeterAndInvoice(
		application.WaterMeter{
			MeterID:     200,
			OrgID:       2,
			UserID:      200,
			MeterNumber: "ORG2-0001",
			Status:      "active",
			OweCount:    1,
		},
		application.WaterInvoice{
			ID:        200,
			InvoiceNo: "INV-ORG2-0001",
			OrgID:     2,
			MeterID:   200,
			PeriodID:  1,
			TotalPaid: 150.00,
			Status:    "invoice",
		},
	)
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Org 1 admin must be forbidden from paying Org 2 invoice
	org1Payload := `{"user_id":200,"invoice_ids":[200],"amount":150.00,"batch_id":"66666666-6666-4666-8666-666666666661"}`
	reqOrg1 := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", strings.NewReader(org1Payload))
	reqOrg1.Header.Set("Authorization", "Bearer valid-admin-token")
	reqOrg1.Header.Set("Content-Type", "application/json")
	recOrg1 := httptest.NewRecorder()
	srv.ServeHTTP(recOrg1, reqOrg1)
	if recOrg1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for org 1 admin paying org 2 invoice, got %d: %s", recOrg1.Code, recOrg1.Body.String())
	}

	// Super admin can view outstanding and pay cross-org invoice consistently
	outReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/200/outstanding", nil)
	outReq.Header.Set("Authorization", "Bearer valid-superadmin-token")
	outRec := httptest.NewRecorder()
	srv.ServeHTTP(outRec, outReq)
	if outRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for super_admin outstanding, got %d: %s", outRec.Code, outRec.Body.String())
	}

	superPayload := `{"user_id":200,"invoice_ids":[200],"amount":150.00,"batch_id":"66666666-6666-4666-8666-666666666662"}`
	reqSuper := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/payments/bulk", strings.NewReader(superPayload))
	reqSuper.Header.Set("Authorization", "Bearer valid-superadmin-token")
	reqSuper.Header.Set("Content-Type", "application/json")
	recSuper := httptest.NewRecorder()
	srv.ServeHTTP(recSuper, reqSuper)
	if recSuper.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for super_admin cross-org bulk payment, got %d: %s", recSuper.Code, recSuper.Body.String())
	}
	var res struct {
		OrgID    int64                      `json:"org_id"`
		Invoices []application.WaterInvoice `json:"invoices"`
	}
	_ = json.Unmarshal(recSuper.Body.Bytes(), &res)
	if res.OrgID != 2 || len(res.Invoices) != 1 || res.Invoices[0].Status != "paid" {
		t.Fatalf("unexpected super_admin bulk payment result: %+v", res)
	}
}

func TestCreateDebtNotice_AdminOnly(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	payload := `{"user_id":1,"invoice_ids":[1]}`

	// Staff role -> 403 Forbidden
	reqStaff := httptest.NewRequest(http.MethodPost, "/api/v1/debt-notices", strings.NewReader(payload))
	reqStaff.Header.Set("Authorization", "Bearer valid-reader-token")
	reqStaff.Header.Set("Content-Type", "application/json")
	recStaff := httptest.NewRecorder()
	srv.ServeHTTP(recStaff, reqStaff)
	if recStaff.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for staff role, got %d: %s", recStaff.Code, recStaff.Body.String())
	}

	// Admin role -> 201 Created
	reqAdmin := httptest.NewRequest(http.MethodPost, "/api/v1/debt-notices", strings.NewReader(payload))
	reqAdmin.Header.Set("Authorization", "Bearer valid-admin-token")
	reqAdmin.Header.Set("Content-Type", "application/json")
	recAdmin := httptest.NewRecorder()
	srv.ServeHTTP(recAdmin, reqAdmin)
	if recAdmin.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for admin role, got %d: %s", recAdmin.Code, recAdmin.Body.String())
	}

	var notice struct {
		ID                 string  `json:"id"`
		OrgID              int64   `json:"org_id"`
		UserID             int64   `json:"user_id"`
		InvoiceIDs         []int64 `json:"invoice_ids"`
		TotalOverdueAmount float64 `json:"total_overdue_amount"`
		Status             string  `json:"status"`
		NoticeSentAt       string  `json:"notice_sent_at"`
	}
	if err := json.Unmarshal(recAdmin.Body.Bytes(), &notice); err != nil {
		t.Fatalf("decode debt notice: %v", err)
	}
	if notice.ID == "" {
		t.Fatalf("expected non-empty debt notice id")
	}
	if notice.Status != "sent" {
		t.Fatalf("expected status 'sent', got %q", notice.Status)
	}
	if notice.NoticeSentAt == "" {
		t.Fatalf("expected notice_sent_at to be set")
	}
	if notice.UserID != 1 || len(notice.InvoiceIDs) != 1 || notice.InvoiceIDs[0] != 1 {
		t.Fatalf("unexpected notice fields: %+v", notice)
	}
	if diff := notice.TotalOverdueAmount - 101.65; diff < -0.01 || diff > 0.01 {
		t.Fatalf("expected total_overdue_amount 101.65, got %.2f", notice.TotalOverdueAmount)
	}
}

func TestCutMeter_RequiresDebtNoticeID(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// 1. Nonexistent debt notice -> 404 Not Found
	reqMissing := httptest.NewRequest(http.MethodPatch, "/api/v1/debt-notices/nonexistent/cut", strings.NewReader(`{"meter_reading":125.5}`))
	reqMissing.Header.Set("Authorization", "Bearer valid-reader-token")
	reqMissing.Header.Set("Content-Type", "application/json")
	recMissing := httptest.NewRecorder()
	srv.ServeHTTP(recMissing, reqMissing)
	if recMissing.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found for nonexistent debt notice, got %d: %s", recMissing.Code, recMissing.Body.String())
	}

	// 2. Admin creates debt notice for user 1
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/debt-notices", strings.NewReader(`{"user_id":1,"invoice_ids":[1]}`))
	createReq.Header.Set("Authorization", "Bearer valid-admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	srv.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create debt notice failed: %d %s", createRec.Code, createRec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)

	// 3. Staff cuts meter using valid debt notice ID -> 200 OK
	cutReq := httptest.NewRequest(http.MethodPatch, "/api/v1/debt-notices/"+created.ID+"/cut", strings.NewReader(`{"meter_reading":125.5}`))
	cutReq.Header.Set("Authorization", "Bearer valid-reader-token")
	cutReq.Header.Set("Content-Type", "application/json")
	cutRec := httptest.NewRecorder()
	srv.ServeHTTP(cutRec, cutReq)
	if cutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for cut meter, got %d: %s", cutRec.Code, cutRec.Body.String())
	}
	var cutResp struct {
		Status          string   `json:"status"`
		CutMeterReading *float64 `json:"cut_meter_reading"`
		CutAt           string   `json:"cut_at"`
	}
	_ = json.Unmarshal(cutRec.Body.Bytes(), &cutResp)
	if cutResp.Status != "cut" || cutResp.CutMeterReading == nil || *cutResp.CutMeterReading != 125.5 || cutResp.CutAt == "" {
		t.Fatalf("unexpected cut response: %+v", cutResp)
	}

	// 4. Verify meter 1 status is now 'disconnected' and cutmeter == '1'
	metersReq := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/meters", nil)
	metersReq.Header.Set("Authorization", "Bearer valid-reader-token")
	metersRec := httptest.NewRecorder()
	srv.ServeHTTP(metersRec, metersReq)
	if metersRec.Code != http.StatusOK {
		t.Fatalf("list meters failed: %d", metersRec.Code)
	}
	var metersResp struct {
		Items []application.WaterMeter `json:"items"`
	}
	_ = json.Unmarshal(metersRec.Body.Bytes(), &metersResp)
	found := false
	for _, m := range metersResp.Items {
		if m.UserID == 1 {
			found = true
			if m.Status != "disconnected" || m.CutMeter != "1" {
				t.Fatalf("expected meter status 'disconnected' & cutmeter '1', got status=%q cutmeter=%q", m.Status, m.CutMeter)
			}
		}
	}
	if !found {
		t.Fatalf("meter for user 1 not found")
	}
}

func TestRestoreMeter_BlockedWhenOutstanding(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// 1. Admin creates debt notice for user 1 (who has unpaid invoice 1)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/debt-notices", strings.NewReader(`{"user_id":1,"invoice_ids":[1]}`))
	createReq.Header.Set("Authorization", "Bearer valid-admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	srv.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create debt notice failed: %d %s", createRec.Code, createRec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(createRec.Body.Bytes(), &created)

	// 2. Staff cuts meter
	cutReq := httptest.NewRequest(http.MethodPatch, "/api/v1/debt-notices/"+created.ID+"/cut", strings.NewReader(`{"meter_reading":130}`))
	cutReq.Header.Set("Authorization", "Bearer valid-reader-token")
	cutReq.Header.Set("Content-Type", "application/json")
	cutRec := httptest.NewRecorder()
	srv.ServeHTTP(cutRec, cutReq)
	if cutRec.Code != http.StatusOK {
		t.Fatalf("cut meter failed: %d %s", cutRec.Code, cutRec.Body.String())
	}

	// 3. Restore while invoice 1 is still unpaid -> 400 Bad Request "outstanding balance remaining"
	restoreBlockedReq := httptest.NewRequest(http.MethodPatch, "/api/v1/debt-notices/"+created.ID+"/restore", nil)
	restoreBlockedReq.Header.Set("Authorization", "Bearer valid-reader-token")
	restoreBlockedRec := httptest.NewRecorder()
	srv.ServeHTTP(restoreBlockedRec, restoreBlockedReq)
	if restoreBlockedRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when outstanding balance remains, got %d: %s", restoreBlockedRec.Code, restoreBlockedRec.Body.String())
	}
	if !strings.Contains(strings.ToLower(restoreBlockedRec.Body.String()), "outstanding balance remaining") {
		t.Fatalf("expected error body to contain 'outstanding balance remaining', got: %s", restoreBlockedRec.Body.String())
	}

	// 4. Pay invoice 1 so user 1 has 0 unpaid invoices
	payReq := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/invoices/1/pay", strings.NewReader(`{"payment_method":"cash"}`))
	payReq.Header.Set("Authorization", "Bearer valid-admin-token")
	payReq.Header.Set("Content-Type", "application/json")
	payRec := httptest.NewRecorder()
	srv.ServeHTTP(payRec, payReq)
	if payRec.Code != http.StatusOK {
		t.Fatalf("pay invoice 1 failed: %d %s", payRec.Code, payRec.Body.String())
	}

	// 5. Restore after payment -> 200 OK & meter status back to 'active'
	restoreOKReq := httptest.NewRequest(http.MethodPatch, "/api/v1/debt-notices/"+created.ID+"/restore", nil)
	restoreOKReq.Header.Set("Authorization", "Bearer valid-reader-token")
	restoreOKRec := httptest.NewRecorder()
	srv.ServeHTTP(restoreOKRec, restoreOKReq)
	if restoreOKRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for restore after payment, got %d: %s", restoreOKRec.Code, restoreOKRec.Body.String())
	}
	var restoredResp struct {
		Status     string `json:"status"`
		RestoredAt string `json:"restored_at"`
	}
	_ = json.Unmarshal(restoreOKRec.Body.Bytes(), &restoredResp)
	if restoredResp.Status != "restored" || restoredResp.RestoredAt == "" {
		t.Fatalf("unexpected restore response: %+v", restoredResp)
	}

	// Verify meter 1 status is 'active' and cutmeter == '0'
	metersReq := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/meters", nil)
	metersReq.Header.Set("Authorization", "Bearer valid-reader-token")
	metersRec := httptest.NewRecorder()
	srv.ServeHTTP(metersRec, metersReq)
	var metersResp struct {
		Items []application.WaterMeter `json:"items"`
	}
	_ = json.Unmarshal(metersRec.Body.Bytes(), &metersResp)
	for _, m := range metersResp.Items {
		if m.UserID == 1 {
			if m.Status != "active" || m.CutMeter != "0" {
				t.Fatalf("expected meter status 'active' & cutmeter '0' after restore, got status=%q cutmeter=%q", m.Status, m.CutMeter)
			}
		}
	}
}

func TestGetUserDebtNotices_ResidentSeesOwnOnly(t *testing.T) {
	repo := memory.NewStore()
	svc := services.NewWaterBillService(repo)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     stubVerifier{},
		Blacklist:    blacklist.NewStore(""),
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	// Admin creates a debt notice for user 1
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/debt-notices", strings.NewReader(`{"user_id":1,"invoice_ids":[1]}`))
	createReq.Header.Set("Authorization", "Bearer valid-admin-token")
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	srv.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create debt notice failed: %d %s", createRec.Code, createRec.Body.String())
	}

	// Resident 1 can view own debt notices -> 200 OK with 1 notice
	reqOwn := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/debt-notices", nil)
	reqOwn.Header.Set("Authorization", "Bearer valid-resident-1-token")
	recOwn := httptest.NewRecorder()
	srv.ServeHTTP(recOwn, reqOwn)
	if recOwn.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for resident viewing own debt notices, got %d: %s", recOwn.Code, recOwn.Body.String())
	}
	var ownResp struct {
		Items []struct {
			ID     string `json:"id"`
			UserID int64  `json:"user_id"`
			Status string `json:"status"`
		} `json:"items"`
	}
	if err := json.Unmarshal(recOwn.Body.Bytes(), &ownResp); err != nil {
		t.Fatalf("decode own debt notices: %v", err)
	}
	if len(ownResp.Items) != 1 || ownResp.Items[0].UserID != 1 {
		t.Fatalf("expected 1 debt notice for user 1, got %+v", ownResp.Items)
	}

	// Resident 2 attempting to view user 1's debt notices -> 403 Forbidden
	reqOther := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/debt-notices", nil)
	reqOther.Header.Set("Authorization", "Bearer valid-resident-2-token")
	recOther := httptest.NewRecorder()
	srv.ServeHTTP(recOther, reqOther)
	if recOther.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for resident 2 viewing user 1 debt notices, got %d: %s", recOther.Code, recOther.Body.String())
	}

	// Staff can view user 1's debt notices -> 200 OK
	reqStaff := httptest.NewRequest(http.MethodGet, "/api/v1/users/1/debt-notices", nil)
	reqStaff.Header.Set("Authorization", "Bearer valid-reader-token")
	recStaff := httptest.NewRecorder()
	srv.ServeHTTP(recStaff, reqStaff)
	if recStaff.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for staff viewing user 1 debt notices, got %d: %s", recStaff.Code, recStaff.Body.String())
	}
}




