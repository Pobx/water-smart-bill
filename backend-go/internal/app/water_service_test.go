package app_test

import (
	"context"
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/internal/adapter/out/memory"
	"github.com/pobx/water-smart-bill/backend-go/internal/app"
	"github.com/pobx/water-smart-bill/backend-go/internal/domain"
)

func int64Ptr(v int64) *int64 { return &v }

func TestWaterServiceEndToEndWorkflow(t *testing.T) {
	ctx := context.Background()
	repo := memory.NewStore()
	svc := app.NewWaterService(repo)

	claims := domain.Claims{
		JTI:      "jti-admin-1",
		Subject:  "admin-1",
		Username: "somchai_admin",
		Roles:    []string{domain.RoleAdmin, domain.RoleTabwaterStaff, domain.RoleFinanceStaff},
		OrgID:    int64Ptr(1),
	}

	// 1. Create homeowner without uploaded avatar -> must return automatic default avatar URL
	homeowner, err := svc.CreateHomeowner(ctx, claims, domain.CreateHomeownerCommand{
		Username:   "prasert_10",
		Prefix:     "นาย",
		FirstName:  "ประเสริฐ",
		LastName:   "มีสุข",
		HouseNo:    "88/9",
		Address:    "88/9 หมู่ที่ 1 ต.ห้องแซง",
		ZoneID:     1,
		SubzoneID:  1,
		TambonCode: 350805,
		Phone:      "082-111-2222",
	})
	if err != nil {
		t.Fatalf("create homeowner failed: %v", err)
	}
	if homeowner.AvatarURL == "" {
		t.Fatalf("expected default avatar URL when no image uploaded")
	}

	// 2. Register water meter for the homeowner
	meter, err := svc.CreateMeter(ctx, claims, domain.CreateWaterMeterCommand{
		UserID:         homeowner.ID,
		MeterNumber:    "HSG-0088",
		FactoryNo:      "SN-8800",
		SubmeterName:   "นายประเสริฐ มีสุข",
		MeterAddress:   "88/9 หมู่ที่ 1",
		ZoneID:         1,
		SubzoneID:      1,
		MeterTypeID:    1,
		InitialReading: 100,
	})
	if err != nil {
		t.Fatalf("create meter failed: %v", err)
	}

	// 3. Sync offline reading with client_reading_id (idempotent)
	syncRes, err := svc.SyncOfflineReadings(ctx, claims, domain.OfflineSyncBatchCommand{
		Readings: []domain.RecordMeterReadingCommand{
			{
				ClientReadingID: "offline-uuid-001",
				InvoiceNo:       "INV-2569-11-0088",
				MeterID:         meter.MeterID,
				PeriodID:        1,
				CurrentMeter:    125, // 25 units used -> 170 water + 10 reserve + 12.60 VAT = 192.60
				ReserveFee:      10,
				VatPercent:      7,
				ReadingPhotoURL: "/uploads/meters/hsg-0088.jpg",
				OCRText:         "00125",
				OCRConfidence:   97.5,
			},
		},
	})
	if err != nil {
		t.Fatalf("sync offline readings failed: %v", err)
	}
	if syncRes.SyncedCount != 1 || len(syncRes.Invoices) != 1 {
		t.Fatalf("expected 1 synced invoice, got %+v", syncRes)
	}
	if syncRes.Invoices[0].TotalPaid != 192.60 {
		t.Fatalf("expected totalpaid 192.60, got %.2f", syncRes.Invoices[0].TotalPaid)
	}

	// Re-sending same client_reading_id must be idempotent (no duplicate invoice)
	syncResDup, err := svc.SyncOfflineReadings(ctx, claims, domain.OfflineSyncBatchCommand{
		Readings: []domain.RecordMeterReadingCommand{
			{
				ClientReadingID: "offline-uuid-001",
				InvoiceNo:       "INV-2569-11-0088",
				MeterID:         meter.MeterID,
				PeriodID:        1,
				CurrentMeter:    125,
				ReserveFee:      10,
				VatPercent:      7,
			},
		},
	})
	if err != nil {
		t.Fatalf("idempotent re-sync failed: %v", err)
	}
	if syncResDup.Invoices[0].ID != syncRes.Invoices[0].ID {
		t.Fatalf("expected idempotent invoice ID %d, got %d", syncRes.Invoices[0].ID, syncResDup.Invoices[0].ID)
	}

	// 4. Resident views bill via LINE LIFF
	portal, err := svc.LinkLiffAccount(ctx, domain.LiffLinkAccountCommand{
		LineUserID:  "U_LINE_PRASERT_88",
		MeterNumber: "HSG-0088",
		HouseNo:     "88/9",
	})
	if err != nil {
		t.Fatalf("link liff account failed: %v", err)
	}
	if portal.UnpaidTotal != 192.60 {
		t.Fatalf("expected LIFF unpaid total 192.60, got %.2f", portal.UnpaidTotal)
	}
}
