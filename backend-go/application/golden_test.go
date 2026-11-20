package application_test

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

var updateGolden = flag.Bool("update", false, "update .golden master files")

func ptrInt(i int) *int {
	return &i
}

func defaultRateTiers() []application.RateTier {
	return []application.RateTier{
		{TierOrder: 1, MinUnits: 1, MaxUnits: ptrInt(10), RatePerUnit: 5.0, Comment: "Tier 1 (1-10)"},
		{TierOrder: 2, MinUnits: 11, MaxUnits: ptrInt(20), RatePerUnit: 7.0, Comment: "Tier 2 (11-20)"},
		{TierOrder: 3, MinUnits: 21, MaxUnits: ptrInt(50), RatePerUnit: 10.0, Comment: "Tier 3 (21-50)"},
		{TierOrder: 4, MinUnits: 51, MaxUnits: nil, RatePerUnit: 12.0, Comment: "Tier 4 (51+)"},
	}
}

// TestProgressiveWaterBillGolden verifies progressive tariff calculations against canonical golden file.
func TestProgressiveWaterBillGolden(t *testing.T) {
	tiers := defaultRateTiers()
	reserveFee := 10.0
	vatRate := 7.0

	testConsumptions := []float64{0, 5, 15, 35, 75}
	results := make([]application.WaterBillBreakdown, 0, len(testConsumptions))

	for _, units := range testConsumptions {
		breakdown := application.CalculateProgressiveWaterBill(units, tiers, reserveFee, vatRate)
		results = append(results, breakdown)
	}

	actualBytes, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal actual results: %v", err)
	}

	goldenPath := filepath.Join("testdata", "progressive_water_bill.golden.json")

	if *updateGolden {
		if err := os.MkdirAll("testdata", 0755); err != nil {
			t.Fatalf("failed to create testdata dir: %v", err)
		}
		if err := os.WriteFile(goldenPath, actualBytes, 0644); err != nil {
			t.Fatalf("failed to update golden file: %v", err)
		}
		t.Logf("Updated golden file: %s", goldenPath)
	}

	expectedBytes, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("failed to read golden file %s (run with -update to generate): %v", goldenPath, err)
	}

	actualStr := strings.TrimSpace(string(actualBytes))
	expectedStr := strings.TrimSpace(string(expectedBytes))

	if actualStr != expectedStr {
		t.Errorf("Golden test mismatch!\nExpected:\n%s\nActual:\n%s", expectedStr, actualStr)
	}
}

// TestThermalReceiptFormatGolden verifies thermal receipt output against golden text file.
func TestThermalReceiptFormatGolden(t *testing.T) {
	bill := struct {
		OrgName       string  `json:"org_name"`
		InvNo         string  `json:"inv_no"`
		PeriodName    string  `json:"period_name"`
		MeterNumber   string  `json:"meter_number"`
		HomeownerName string  `json:"homeowner_name"`
		HouseNo       string  `json:"house_no"`
		LastMeter     float64 `json:"last_meter"`
		CurrentMeter  float64 `json:"current_meter"`
		WaterUsed     float64 `json:"water_used"`
		WaterCharge   float64 `json:"water_charge"`
		ReserveFee    float64 `json:"reserve_fee"`
		Vat           float64 `json:"vat"`
		TotalPaid     float64 `json:"total_paid"`
		RecordedAt    string  `json:"recorded_at"`
	}{
		OrgName:       "องค์การบริหารส่วนตำบลห้องแซง",
		InvNo:         "INV-2569-11-0001",
		PeriodName:    "11/2569",
		MeterNumber:   "HSG-0001",
		HomeownerName: "นายสมหมาย ใจดี",
		HouseNo:       "101/1",
		LastMeter:     120,
		CurrentMeter:  135,
		WaterUsed:     15,
		WaterCharge:   85.00,
		ReserveFee:    10.00,
		Vat:           6.65,
		TotalPaid:     101.65,
		RecordedAt:    "2026-11-20 10:30",
	}

	divider := "--------------------------------"
	receiptText := strings.Join([]string{
		bill.OrgName,
		"ใบแจ้งหนี้ค่าน้ำประปา",
		divider,
		"เลขที่บิล : " + bill.InvNo,
		"ประจำงวด : " + bill.PeriodName,
		"วันที่จด   : " + bill.RecordedAt,
		divider,
		"เลขมิเตอร์: " + bill.MeterNumber,
		"ผู้ใช้น้ำ  : " + bill.HomeownerName,
		"บ้านเลขที่: " + bill.HouseNo,
		divider,
		"เลขครั้งก่อน: 120.00 m3",
		"เลขครั้งนี้ : 135.00 m3",
		"หน่วยที่ใช้ : 15.00 m3",
		divider,
		"ค่าน้ำประปา      : 85.00 บ.",
		"ค่ารักษามิเตอร์   : 10.00 บ.",
		"VAT 7%          : 6.65 บ.",
		divider,
		"ยอดชำระสุทธิ     : 101.65 บาท",
		divider,
		"ชำระเงินที่เคาน์เตอร์ อบต.",
		"Ref: " + bill.MeterNumber,
	}, "\n")

	goldenPath := filepath.Join("testdata", "thermal_receipt.golden.txt")

	if *updateGolden {
		if err := os.MkdirAll("testdata", 0755); err != nil {
			t.Fatalf("failed to create testdata dir: %v", err)
		}
		if err := os.WriteFile(goldenPath, []byte(receiptText), 0644); err != nil {
			t.Fatalf("failed to update golden file: %v", err)
		}
		t.Logf("Updated golden file: %s", goldenPath)
	}

	expectedBytes, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("failed to read golden file %s (run with -update to generate): %v", goldenPath, err)
	}

	if receiptText != strings.TrimSpace(string(expectedBytes)) {
		t.Errorf("Thermal receipt golden mismatch!\nExpected:\n%s\nActual:\n%s", string(expectedBytes), receiptText)
	}
}
