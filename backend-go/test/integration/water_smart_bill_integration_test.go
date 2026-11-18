package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

type integrationVerifier struct{}

func (integrationVerifier) VerifyAccessToken(_ context.Context, rawToken string) (application.Claims, error) {
	orgID := int64(1)
	if rawToken == "valid-jwt-token" {
		return application.Claims{
			JTI:       "jti-integration-1",
			Subject:   "staff-integration-1",
			Username:  "user@sao.go.th",
			Roles:     []string{application.RoleAdmin, application.RoleFinanceStaff, application.RoleTabwaterStaff},
			OrgID:     &orgID,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		}, nil
	}
	return application.Claims{}, application.ErrUnauthorized
}

// TestWaterSmartBillFullSystemIntegration runs a full integration journey testing:
// Master Data -> Tariffs -> Meter -> Offline Sync (Idempotent) -> Cashier Payment -> Receipt -> CSV Export -> LINE LIFF -> JWT Blacklist.
func TestWaterSmartBillFullSystemIntegration(t *testing.T) {
	memStore := memory.NewStore()
	svc := services.NewWaterBillService(memStore)
	bl := blacklist.NewStore("")
	verifier := integrationVerifier{}

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:       "development",
		Verifier:     verifier,
		Blacklist:    bl,
		WaterService: svc,
		UploadDir:    t.TempDir(),
	})

	token := "valid-jwt-token"

	// 1. Master Data: Create Homeowner without photo -> verify Default SVG Avatar Fallback
	ownerBody, _ := json.Marshal(map[string]any{
		"prefix":       "นาย",
		"firstname":    "ประสิทธิ์",
		"lastname":     "มั่นคง",
		"house_no":     "100/1",
		"zone_id":      1,
		"subzone_id":   1,
		"tambon_code":  350805,
		"phone":        "089-111-2222",
		"line_user_id": "U_PRASIT_100",
		"image":        "",
	})
	reqOwner := httptest.NewRequest(http.MethodPost, "/api/v1/users", bytes.NewReader(ownerBody))
	reqOwner.Header.Set("Authorization", "Bearer "+token)
	reqOwner.Header.Set("Content-Type", "application/json")
	recOwner := httptest.NewRecorder()
	srv.ServeHTTP(recOwner, reqOwner)
	if recOwner.Code != http.StatusCreated {
		t.Fatalf("create homeowner failed: %d, body: %s", recOwner.Code, recOwner.Body.String())
	}

	var createdOwner application.HomeownerUser
	if err := json.Unmarshal(recOwner.Body.Bytes(), &createdOwner); err != nil {
		t.Fatalf("unmarshal owner: %v", err)
	}
	if !strings.HasPrefix(createdOwner.AvatarURL, "/api/v1/avatars/default?name=") {
		t.Fatalf("expected default avatar fallback URL, got: %s", createdOwner.AvatarURL)
	}

	// 2. Register Water Meter
	meterBody, _ := json.Marshal(map[string]any{
		"user_id":         createdOwner.ID,
		"meternumber":     "HSG-9001",
		"factory_no":      "FAC-9001",
		"initial_reading": 200,
		"zone_id":         1,
		"subzone_id":      1,
		"metertype_id":    1,
	})
	reqMeter := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/meters", bytes.NewReader(meterBody))
	reqMeter.Header.Set("Authorization", "Bearer "+token)
	reqMeter.Header.Set("Content-Type", "application/json")
	recMeter := httptest.NewRecorder()
	srv.ServeHTTP(recMeter, reqMeter)
	if recMeter.Code != http.StatusCreated {
		t.Fatalf("create meter failed: %d, body: %s", recMeter.Code, recMeter.Body.String())
	}
	var createdMeter application.WaterMeter
	_ = json.Unmarshal(recMeter.Body.Bytes(), &createdMeter)

	// 3. Offline Bundle download for field tablet
	reqBundle := httptest.NewRequest(http.MethodGet, "/api/v1/tabwater/offline-bundle?zone_id=1", nil)
	reqBundle.Header.Set("Authorization", "Bearer "+token)
	recBundle := httptest.NewRecorder()
	srv.ServeHTTP(recBundle, reqBundle)
	if recBundle.Code != http.StatusOK {
		t.Fatalf("get offline bundle failed: %d", recBundle.Code)
	}
	var bundle application.OfflineBundle
	_ = json.Unmarshal(recBundle.Body.Bytes(), &bundle)
	if len(bundle.Meters) == 0 || bundle.RateConfig.ReserveFee <= 0 {
		t.Fatalf("expected valid offline bundle, got meters=%d, reserve_fee=%.2f", len(bundle.Meters), bundle.RateConfig.ReserveFee)
	}

	// 4. Offline-First Sync with Idempotency Key (client_reading_id)
	clientUUID := "offline-sync-uuid-prasit-01"
	syncPayload, _ := json.Marshal(map[string]any{
		"readings": []map[string]any{
			{
				"client_reading_id": clientUUID,
				"inv_no":            "INV-2569-11-9001",
				"meter_id":          createdMeter.MeterID,
				"period_id":         1,
				"current_meter":     225, // 25 units used
				"ocr_text":          "00225",
				"ocr_confidence":    98.7,
			},
		},
	})

	// First sync call
	reqSync1 := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings/sync", bytes.NewReader(syncPayload))
	reqSync1.Header.Set("Authorization", "Bearer "+token)
	reqSync1.Header.Set("Content-Type", "application/json")
	recSync1 := httptest.NewRecorder()
	srv.ServeHTTP(recSync1, reqSync1)
	if recSync1.Code != http.StatusOK {
		t.Fatalf("first sync failed: %d: %s", recSync1.Code, recSync1.Body.String())
	}
	var syncRes1 application.OfflineSyncBatchResult
	_ = json.Unmarshal(recSync1.Body.Bytes(), &syncRes1)
	if syncRes1.SyncedCount != 1 || len(syncRes1.Invoices) == 0 {
		t.Fatalf("expected 1 synced invoice, got %+v", syncRes1)
	}
	invoiceID := syncRes1.Invoices[0].ID

	// Second sync call with same payload -> Must return existing invoice without duplicate
	reqSync2 := httptest.NewRequest(http.MethodPost, "/api/v1/tabwater/readings/sync", bytes.NewReader(syncPayload))
	reqSync2.Header.Set("Authorization", "Bearer "+token)
	reqSync2.Header.Set("Content-Type", "application/json")
	recSync2 := httptest.NewRecorder()
	srv.ServeHTTP(recSync2, reqSync2)
	var syncRes2 application.OfflineSyncBatchResult
	_ = json.Unmarshal(recSync2.Body.Bytes(), &syncRes2)
	if syncRes2.Invoices[0].ID != invoiceID {
		t.Fatalf("expected idempotent response with invoice #%d, got #%d", invoiceID, syncRes2.Invoices[0].ID)
	}

	// 5. Finance & Cashier: Pay Invoice at SAO Counter
	payBody, _ := json.Marshal(map[string]any{
		"payment_method": "cash",
	})
	reqPay := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/tabwater/invoices/%d/pay", invoiceID), bytes.NewReader(payBody))
	reqPay.Header.Set("Authorization", "Bearer "+token)
	reqPay.Header.Set("Content-Type", "application/json")
	recPay := httptest.NewRecorder()
	srv.ServeHTTP(recPay, reqPay)
	if recPay.Code != http.StatusOK {
		t.Fatalf("pay invoice failed: %d, body: %s", recPay.Code, recPay.Body.String())
	}
	var paidInvoice application.WaterInvoice
	_ = json.Unmarshal(recPay.Body.Bytes(), &paidInvoice)
	if paidInvoice.Status != "paid" || paidInvoice.ReceiptNo == "" || paidInvoice.PaymentMethod != "cash" {
		t.Fatalf("expected paid invoice with receipt_no, got %+v", paidInvoice)
	}

	// 6. Finance & Cashier: Collection Report CSV Export
	reqCSV := httptest.NewRequest(http.MethodGet, "/api/v1/water-bills/reports/collections?format=csv", nil)
	reqCSV.Header.Set("Authorization", "Bearer "+token)
	recCSV := httptest.NewRecorder()
	srv.ServeHTTP(recCSV, reqCSV)
	if recCSV.Code != http.StatusOK {
		t.Fatalf("get CSV report failed: %d", recCSV.Code)
	}
	csvContent := recCSV.Body.String()
	if !strings.Contains(csvContent, "เลขที่บิล") || !strings.Contains(csvContent, paidInvoice.InvoiceNo) || !strings.Contains(csvContent, "รวมทั้งสิ้น") {
		t.Fatalf("expected valid CSV report with header and invoice row, got: %s", csvContent)
	}

	// 7. LINE LIFF Resident Portal lookup
	reqLiff := httptest.NewRequest(http.MethodGet, "/api/v1/liff/bills?line_user_id=U_PRASIT_100", nil)
	recLiff := httptest.NewRecorder()
	srv.ServeHTTP(recLiff, reqLiff)
	if recLiff.Code != http.StatusOK {
		t.Fatalf("get liff bills failed: %d", recLiff.Code)
	}
	var liffData application.LiffResidentPortalData
	_ = json.Unmarshal(recLiff.Body.Bytes(), &liffData)
	if liffData.Homeowner.HouseNo != "100/1" || len(liffData.Invoices) == 0 {
		t.Fatalf("expected homeowner 100/1 with paid invoice in LIFF, got %+v", liffData)
	}

	// 8. Logout & JWT Blacklist: Revoke Token
	reqLogout := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer "+token)
	recLogout := httptest.NewRecorder()
	srv.ServeHTTP(recLogout, reqLogout)
	if recLogout.Code != http.StatusOK {
		t.Fatalf("logout failed: %d", recLogout.Code)
	}

	// 9. Subsequent request using the revoked token must return 401 Unauthorized
	reqUnauthorized := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	reqUnauthorized.Header.Set("Authorization", "Bearer "+token)
	recUnauthorized := httptest.NewRecorder()
	srv.ServeHTTP(recUnauthorized, reqUnauthorized)
	if recUnauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for blacklisted token, got: %d", recUnauthorized.Code)
	}
}
