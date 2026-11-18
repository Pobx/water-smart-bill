package application_test

import (
	"strings"
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

func intPtr(v int) *int { return &v }

func TestCalculateProgressiveWaterBill(t *testing.T) {
	tiers := []application.RateTier{
		{TierOrder: 1, MinUnits: 1, MaxUnits: intPtr(10), RatePerUnit: 5.0},
		{TierOrder: 2, MinUnits: 11, MaxUnits: intPtr(20), RatePerUnit: 7.0},
		{TierOrder: 3, MinUnits: 21, MaxUnits: intPtr(50), RatePerUnit: 10.0},
		{TierOrder: 4, MinUnits: 51, MaxUnits: nil, RatePerUnit: 12.0},
	}

	bill := application.CalculateProgressiveWaterBill(15, tiers, 10, 7)
	if bill.WaterCharge != 85.0 {
		t.Fatalf("expected water charge 85.00, got %.2f", bill.WaterCharge)
	}
	if bill.TotalPayable != 101.65 {
		t.Fatalf("expected total payable 101.65, got %.2f", bill.TotalPayable)
	}
}

func TestResolveAvatarURLAndDefaultSVG(t *testing.T) {
	fallback := application.ResolveAvatarURL("", "สมหมาย", "ใจดี")
	if !strings.HasPrefix(fallback, "/api/v1/avatars/default?name=") {
		t.Fatalf("expected default avatar fallback URL, got %s", fallback)
	}
	svg := application.GenerateDefaultAvatarSVG("สมหมาย ใจดี")
	if !strings.Contains(svg, "<svg") {
		t.Fatalf("expected valid SVG output, got %s", svg)
	}
}

func TestDomainEntityIsValid(t *testing.T) {
	validHomeowner := application.CreateHomeownerCommand{FirstName: "สมหมาย", HouseNo: "101/1"}
	if ok, err := validHomeowner.IsValid(); !ok || err != nil {
		t.Fatalf("expected valid homeowner command, got ok=%v err=%v", ok, err)
	}
	invalidHomeowner := application.CreateHomeownerCommand{FirstName: "", HouseNo: ""}
	if ok, err := invalidHomeowner.IsValid(); ok || err == nil {
		t.Fatalf("expected invalid homeowner command to fail IsValid()")
	}
}
