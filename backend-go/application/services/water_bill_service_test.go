package services_test

import (
	"context"
	"strings"
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/adapters/memory"
	"github.com/pobx/water-smart-bill/backend-go/application"
	"github.com/pobx/water-smart-bill/backend-go/application/services"
)

func TestWaterBillServiceUseCases(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	svc := services.NewWaterBillService(store)

	orgID := int64(1)
	claims := application.Claims{
		JTI:      "test-jti-1",
		Subject:  "staff-1",
		Username: "somchai_staff",
		Roles:    []string{application.RoleAdmin, application.RoleTabwaterStaff, application.RoleFinanceStaff},
		OrgID:    &orgID,
	}

	// 1. SAO Organization profile
	org, err := svc.GetOrganization(ctx, claims)
	if err != nil {
		t.Fatalf("get org: %v", err)
	}
	if org.Name == "" {
		t.Fatalf("expected seeded organization name, got empty")
	}

	// 2. Create Homeowner WITHOUT uploaded photo -> must get automatic Default Avatar URL
	owner, err := svc.CreateHomeowner(ctx, claims, application.CreateHomeownerCommand{
		Prefix:     "นางสาว",
		FirstName:  "กานดา",
		LastName:   "รักษ์น้ำ",
		HouseNo:    "99/8",
		ZoneID:     1,
		SubzoneID:  1,
		TambonCode: 350805,
		Phone:      "081-999-8888",
		LineUserID: "U_KANDA_99",
		ImageURL:   "",
	})
	if err != nil {
		t.Fatalf("create homeowner: %v", err)
	}
	if !strings.HasPrefix(owner.AvatarURL, "/api/v1/avatars/default?name=") {
		t.Fatalf("expected default avatar fallback for homeowner without photo, got %s", owner.AvatarURL)
	}

	// 3. Register Water Meter
	meter, err := svc.CreateMeter(ctx, claims, application.CreateWaterMeterCommand{
		UserID:         owner.ID,
		MeterNumber:    "HSG-0099",
		FactoryNo:      "FAC-9988",
		InitialReading: 100,
		ZoneID:         1,
		SubzoneID:      1,
		MeterTypeID:    1,
	})
	if err != nil {
		t.Fatalf("create meter: %v", err)
	}

	// 4. Record Meter Reading + Progressive Tariff Calculation + Idempotent Offline Sync
	readingCmd := application.RecordMeterReadingCommand{
		ClientReadingID: "offline-uuid-9988",
		InvoiceNo:       "INV-2569-11-0099",
		MeterID:         meter.MeterID,
		PeriodID:        1,
		CurrentMeter:    115,
		OCRText:         "00115",
		OCRConfidence:   97.4,
	}
	inv, err := svc.RecordMeterReading(ctx, claims, readingCmd)
	if err != nil {
		t.Fatalf("record meter reading: %v", err)
	}
	if inv.WaterUsed != 15 || inv.TotalPaid != 101.65 {
		t.Fatalf("expected 15 units & 101.65 THB, got units=%.2f total=%.2f", inv.WaterUsed, inv.TotalPaid)
	}

	// 5. Idempotency check via Offline Sync Batch
	syncRes, err := svc.SyncOfflineReadings(ctx, claims, application.OfflineSyncBatchCommand{
		Readings: []application.RecordMeterReadingCommand{readingCmd},
	})
	if err != nil {
		t.Fatalf("sync offline readings: %v", err)
	}
	if syncRes.SyncedCount != 1 || syncRes.Invoices[0].ID != inv.ID {
		t.Fatalf("expected idempotent sync to return existing invoice #%d, got %+v", inv.ID, syncRes)
	}

	// 6. LINE LIFF Resident Portal lookup
	portal, err := svc.GetLiffPortalData(ctx, "U_KANDA_99", "", "")
	if err != nil {
		t.Fatalf("get liff portal data: %v", err)
	}
	if portal.Homeowner.HouseNo != "99/8" || len(portal.Invoices) == 0 {
		t.Fatalf("expected LIFF portal data for 99/8 with invoice, got %+v", portal)
	}

	// 7. Finance & Cashier: Pay invoice at SAO desk
	paidInv, err := svc.PayInvoice(ctx, claims, application.PayWaterInvoiceCommand{
		InvoiceID:     inv.ID,
		CashierID:     1,
		PaymentMethod: "cash",
	})
	if err != nil {
		t.Fatalf("pay invoice: %v", err)
	}
	if paidInv.Status != "paid" || paidInv.ReceiptNo == "" || paidInv.PaymentMethod != "cash" {
		t.Fatalf("expected invoice paid with receipt_no, got %+v", paidInv)
	}

	// 8. Finance & Cashier: Generate Collection Summary Report & CSV Export
	periodID := int64(1)
	report, err := svc.GetCollectionReport(ctx, claims, application.CollectionReportFilter{
		PeriodID: &periodID,
	})
	if err != nil {
		t.Fatalf("get collection report: %v", err)
	}
	if report.TotalInvoices < 1 || report.PaidInvoices < 1 || report.TotalCash <= 0 {
		t.Fatalf("expected collection report to have paid cash invoice, got %+v", report)
	}

	csvData, err := svc.ExportCollectionReportCSV(ctx, claims, application.CollectionReportFilter{
		PeriodID: &periodID,
	})
	if err != nil {
		t.Fatalf("export collection report csv: %v", err)
	}
	csvStr := string(csvData)
	if !strings.Contains(csvStr, "เลขที่บิล") || !strings.Contains(csvStr, paidInv.InvoiceNo) || !strings.Contains(csvStr, "รวมทั้งสิ้น") {
		t.Fatalf("expected valid CSV with headers and invoice row, got %s", csvStr)
	}
}
