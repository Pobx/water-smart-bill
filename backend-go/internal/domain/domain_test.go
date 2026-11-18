package domain_test

import (
	"strings"
	"testing"

	"github.com/pobx/water-smart-bill/backend-go/internal/domain"
)

func intPtr(v int) *int       { return &v }
func int64Ptr(v int64) *int64 { return &v }

func TestCalculateProgressiveWaterBill(t *testing.T) {
	tiers := []domain.RateTier{
		{TierOrder: 1, MinUnits: 1, MaxUnits: intPtr(10), RatePerUnit: 5.0},
		{TierOrder: 2, MinUnits: 11, MaxUnits: intPtr(20), RatePerUnit: 7.0},
		{TierOrder: 3, MinUnits: 21, MaxUnits: intPtr(50), RatePerUnit: 10.0},
		{TierOrder: 4, MinUnits: 51, MaxUnits: nil, RatePerUnit: 12.0},
	}

	// Case 1: 0 units used -> only reserve fee + VAT
	zeroBill := domain.CalculateProgressiveWaterBill(0, tiers, 10.0, 7.0)
	if zeroBill.WaterCharge != 0 || zeroBill.ReserveFee != 10.0 || zeroBill.VatAmount != 0.70 || zeroBill.TotalPayable != 10.70 {
		t.Fatalf("unexpected zero bill breakdown: %+v", zeroBill)
	}

	// Case 2: 25 units used ->
	// Tier 1 (10 units * 5) = 50
	// Tier 2 (10 units * 7) = 70
	// Tier 3 (5 units * 10) = 50
	// WaterCharge = 170, Reserve = 10 -> SubTotal = 180 -> VAT 7% = 12.60 -> Total = 192.60
	bill := domain.CalculateProgressiveWaterBill(25, tiers, 10.0, 7.0)
	if bill.UnitsUsed != 25 || bill.WaterCharge != 170.0 || bill.ReserveFee != 10.0 || bill.VatAmount != 12.60 || bill.TotalPayable != 192.60 {
		t.Fatalf("unexpected 25-unit bill breakdown: %+v", bill)
	}
}

func TestResolveAvatarURLAndDefaultSVG(t *testing.T) {
	// If no image is uploaded, must fall back to default avatar URL
	defaultURL := domain.ResolveAvatarURL("", "สมหมาย", "ใจดี")
	if !strings.HasPrefix(defaultURL, "/api/v1/avatars/default?name=") {
		t.Fatalf("expected default avatar fallback URL, got %q", defaultURL)
	}

	// If image is uploaded, return the uploaded URL
	uploadedURL := domain.ResolveAvatarURL("/uploads/avatars/user-1.png", "สมหมาย", "ใจดี")
	if uploadedURL != "/uploads/avatars/user-1.png" {
		t.Fatalf("expected uploaded URL, got %q", uploadedURL)
	}

	// Default SVG generator must return valid SVG containing initials
	svg := domain.GenerateDefaultAvatarSVG("สมหมาย ใจดี")
	if !strings.Contains(svg, "<svg") || !strings.Contains(svg, "</svg>") {
		t.Fatalf("expected valid SVG output, got %q", svg)
	}
}

func TestResolveOrgScope(t *testing.T) {
	claims := domain.Claims{
		Subject: "user-1",
		Roles:   []string{domain.RoleAdmin},
		OrgID:   int64Ptr(1),
	}

	scoped, err := claims.ResolveOrgScope(nil)
	if err != nil || scoped == nil || *scoped != 1 {
		t.Fatalf("expected org 1, got %v, err=%v", scoped, err)
	}

	// Cross-tenant access must be forbidden for non-super-admin
	_, err = claims.ResolveOrgScope(int64Ptr(2))
	if err != domain.ErrForbidden {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestParseMeterOCRReading(t *testing.T) {
	res, err := domain.ParseMeterOCRReading("METER-00142.5 m3", 120)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Reading != 142.5 || res.Digits != "00142.5" || res.Confidence <= 0 {
		t.Fatalf("unexpected OCR result: %+v", res)
	}
}
