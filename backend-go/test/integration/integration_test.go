package integration_test

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
	if strings.Contains(rawToken, "admin") {
		return application.Claims{
			JTI:       "jti-admin-token-1",
			Subject:   "admin-1",
			Username:  "admin_hsg",
			Roles:     []string{application.RoleAdmin, application.RoleTabwaterStaff, application.RoleFinanceStaff},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	if strings.Contains(rawToken, "user") {
		return application.Claims{
			JTI:       "jti-user-token-2",
			Subject:   "user-2",
			Username:  "user_hsg",
			Roles:     []string{application.RoleUser},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	return application.Claims{}, application.ErrUnauthorized
}

func TestEndToEndWaterSmartBillIntegration(t *testing.T) {
	// 1. Setup in-memory Hexagonal stack with blacklist and REST server
	blStore := blacklist.NewStore("")
	memStore := memory.NewStore()
	svc := services.NewWaterBillService(memStore)
	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:          "development",
		AllowDemoTokens: true,
		Verifier:        stubVerifier{},
		Blacklist:       blStore,
		WaterService:    svc,
		UploadDir:       t.TempDir(),
		OpenAPISpec:     []byte("openapi: 3.0.3\ninfo:\n  title: Water Smart Bill API\n  version: 1.0.0\n"),
	})

	const authHeader = "Bearer demo-jwt-admin-token"

	// 2. Health & Swagger OpenAPI checks
	t.Run("Health and Swagger Endpoints", func(t *testing.T) {
		reqHealth := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		recHealth := httptest.NewRecorder()
		srv.ServeHTTP(recHealth, reqHealth)
		if recHealth.Code != http.StatusOK {
			t.Fatalf("expected /healthz 200, got %d", recHealth.Code)
		}

		reqSwagger := httptest.NewRequest(http.MethodGet, "/api/v1/openapi.yaml", nil)
		recSwagger := httptest.NewRecorder()
		srv.ServeHTTP(recSwagger, reqSwagger)
		if recSwagger.Code != http.StatusOK || !strings.Contains(recSwagger.Body.String(), "Water Smart Bill") {
			t.Fatalf("expected /api/v1/openapi.yaml 200 with spec, got %d", recSwagger.Code)
		}
	})

	// 3. Master Data: Create homeowner without photo -> must receive default avatar SVG fallback
	var createdHomeownerID int64
	t.Run("Master Data Household & Default Avatar", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"prefix":      "นาย",
			"firstname":   "ประดิษฐ์",
			"lastname":    "ชลธาร",
			"house_no":    "88/9",
			"zone_id":     1,
			"subzone_id":  1,
			"tambon_code": 350805,
			"phone":       "089-111-2222",
			"line_user_id": "U_PRADIT_889",
			"image":       "", // No uploaded photo
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewReader(body))
		req.Header.Set("Authorization", authHeader)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create homeowner: expected 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var res struct {
			ID        int64  `json:"id"`
			AvatarURL string `json:"avatar_url"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("unmarshal homeowner: %v", err)
		}
		createdHomeownerID = res.ID
		if !strings.HasPrefix(res.AvatarURL, "/api/v1/avatars/default?name=") {
			t.Fatalf("expected default avatar fallback URL, got %s", res.AvatarURL)
		}
	})

	// 4. Register Water Meter for new homeowner
	var registeredMeterID int64
	const meterNumber = "HSG-0889"
	t.Run("Water Meter Registration", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"user_id":         createdHomeownerID,
			"meternumber":     meterNumber,
			"factory_no":      "FAC-8899",
			"initial_reading": 200,
			"zone_id":         1,
			"subzone_id":      1,
			"metertype_id":    1,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/meters", bytes.NewReader(body))
		req.Header.Set("Authorization", authHeader)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("register meter: expected 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var res struct {
			MeterID int64 `json:"meter_id"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
		registeredMeterID = res.MeterID
		if registeredMeterID <= 0 {
			t.Fatalf("expected positive meter ID, got %d", registeredMeterID)
		}
	})

	// 5. Offline-First Bundle retrieval
	t.Run("Offline Bundle", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/offline-bundle", nil)
		req.Header.Set("Authorization", authHeader)
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("offline bundle: expected 200, got %d", rec.Code)
		}
		var bundle application.OfflineBundle
		if err := json.Unmarshal(rec.Body.Bytes(), &bundle); err != nil {
			t.Fatalf("unmarshal bundle: %v", err)
		}
		if len(bundle.Periods) == 0 || len(bundle.Meters) == 0 {
			t.Fatalf("expected non-empty periods and meters in offline bundle, got %+v", bundle)
		}
	})

	// 6. Record Meter Reading with OCR text & progressive calculation
	var createdInvoiceID int64
	var createdInvoiceNo string
	const clientReadingUUID = "offline-reading-uuid-8899"
	t.Run("Record Meter Reading with Progressive Calculation", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"client_reading_id": clientReadingUUID,
			"inv_no":            "INV-2569-11-0889",
			"meter_id":          registeredMeterID,
			"period_id":         1,
			"current_meter":     225, // 225 - 200 = 25 units
			"ocr_text":          "00225",
			"ocr_confidence":    98.5,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings", bytes.NewReader(body))
		req.Header.Set("Authorization", authHeader)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("record reading: expected 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var inv application.WaterInvoice
		if err := json.Unmarshal(rec.Body.Bytes(), &inv); err != nil {
			t.Fatalf("unmarshal invoice: %v", err)
		}
		createdInvoiceID = inv.ID
		createdInvoiceNo = inv.InvoiceNo
		if inv.WaterUsed != 25 || inv.TotalPaid <= 0 || inv.Status != "invoice" {
			t.Fatalf("expected 25 units & valid total payable, got units=%.2f total=%.2f status=%s", inv.WaterUsed, inv.TotalPaid, inv.Status)
		}
	})

	// 7. Test Idempotency with Offline Sync Batch
	t.Run("Idempotent Offline Sync", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{
			"readings": []map[string]any{
				{
					"client_reading_id": clientReadingUUID,
					"inv_no":            createdInvoiceNo,
					"meter_id":          registeredMeterID,
					"period_id":         1,
					"current_meter":     225,
				},
			},
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings/sync", bytes.NewReader(body))
		req.Header.Set("Authorization", authHeader)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("offline sync: expected 200, got %d", rec.Code)
		}

		var res application.OfflineSyncBatchResult
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
		if res.SyncedCount != 1 || len(res.Invoices) != 1 || res.Invoices[0].ID != createdInvoiceID {
			t.Fatalf("expected idempotent response with existing invoice #%d, got %+v", createdInvoiceID, res)
		}
	})

	// 8. Finance & Cashier: Pay invoice at SAO desk
	t.Run("Finance & Cashier Payment and Receipt", func(t *testing.T) {
		payBody, _ := json.Marshal(map[string]any{
			"payment_method": "cash",
		})
		path := "/api/v1/tabwater/invoices/" + strings.TrimSpace(jsonNumber(createdInvoiceID)) + "/pay"
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(payBody))
		req.Header.Set("Authorization", authHeader)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("pay invoice: expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var paidInv application.WaterInvoice
		_ = json.Unmarshal(rec.Body.Bytes(), &paidInv)
		if paidInv.Status != "paid" || !strings.HasPrefix(paidInv.ReceiptNo, "RC-") || paidInv.PaymentMethod != "cash" {
			t.Fatalf("expected paid status with RC-* receipt number, got %+v", paidInv)
		}
	})

	// 9. Finance & Cashier Collection Report (JSON & CSV Export)
	t.Run("Collection Report and CSV Export", func(t *testing.T) {
		reqJSON := httptest.NewRequest(http.MethodGet, "/api/v1/water-bills/reports/collections?period_id=1", nil)
		reqJSON.Header.Set("Authorization", authHeader)
		recJSON := httptest.NewRecorder()
		srv.ServeHTTP(recJSON, reqJSON)
		if recJSON.Code != http.StatusOK {
			t.Fatalf("collection report JSON: expected 200, got %d", recJSON.Code)
		}

		reqCSV := httptest.NewRequest(http.MethodGet, "/api/v1/water-bills/reports/collections?period_id=1&format=csv", nil)
		reqCSV.Header.Set("Authorization", authHeader)
		recCSV := httptest.NewRecorder()
		srv.ServeHTTP(recCSV, reqCSV)
		if recCSV.Code != http.StatusOK {
			t.Fatalf("collection report CSV: expected 200, got %d", recCSV.Code)
		}
		csvContent := recCSV.Body.String()
		if !strings.Contains(csvContent, "เลขที่บิล") || !strings.Contains(csvContent, createdInvoiceNo) {
			t.Fatalf("expected CSV content with header and invoice row, got %s", csvContent)
		}
	})

	// 10. LINE LIFF Resident Portal check
	t.Run("LINE LIFF Resident Portal", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/liff/bills?meternumber="+meterNumber, nil)
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("liff bills: expected 200, got %d", rec.Code)
		}

		var portal application.LiffResidentPortalData
		_ = json.Unmarshal(rec.Body.Bytes(), &portal)
		if portal.Homeowner.HouseNo != "88/9" || len(portal.Invoices) == 0 {
			t.Fatalf("expected homeowner 88/9 in LIFF portal with invoices, got %+v", portal)
		}
	})

	// 11. Security & Blacklist: Logout revokes token
	t.Run("Logout and JWT Blacklist Enforcement", func(t *testing.T) {
		const userToken = "demo-jwt-user-to-logout"
		const userAuthHeader = "Bearer " + userToken

		// Call /me before logout -> 200 OK
		reqMe := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
		reqMe.Header.Set("Authorization", userAuthHeader)
		recMe := httptest.NewRecorder()
		srv.ServeHTTP(recMe, reqMe)
		if recMe.Code != http.StatusOK {
			t.Fatalf("pre-logout /me: expected 200, got %d", recMe.Code)
		}

		// Logout -> 200 OK
		reqLogout := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
		reqLogout.Header.Set("Authorization", userAuthHeader)
		recLogout := httptest.NewRecorder()
		srv.ServeHTTP(recLogout, reqLogout)
		if recLogout.Code != http.StatusOK {
			t.Fatalf("logout: expected 200, got %d", recLogout.Code)
		}

		// Call /me again with revoked token -> MUST return 401 Unauthorized
		reqRevoked := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
		reqRevoked.Header.Set("Authorization", userAuthHeader)
		recRevoked := httptest.NewRecorder()
		srv.ServeHTTP(recRevoked, reqRevoked)
		if recRevoked.Code != http.StatusUnauthorized {
			t.Fatalf("post-logout /me: expected 401 Unauthorized for blacklisted token, got %d", recRevoked.Code)
		}
	})
}

func jsonNumber(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
