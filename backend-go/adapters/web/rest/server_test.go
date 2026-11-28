package rest_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
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



