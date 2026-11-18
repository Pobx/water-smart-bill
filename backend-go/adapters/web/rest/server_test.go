package rest_test

import (
	"bytes"
	"context"
	"encoding/json"
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
