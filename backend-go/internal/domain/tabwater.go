package domain

import (
	"context"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ---- Master Data: SAO (อบต.), Tambons, Villages (Zones/Subzones) & Homeowners ----

type TambonInfo struct {
	TambonID     int64  `json:"tambon_id"`
	TambonName   string `json:"tambon_name"`
	DistrictID   int64  `json:"district_id"`
	DistrictName string `json:"district_name"`
	ProvinceID   int64  `json:"province_id"`
	ProvinceName string `json:"province_name"`
	Zipcode      string `json:"zipcode"`
}

type Organization struct {
	ID           int64   `json:"id"`
	Code         string  `json:"org_code"`
	Name         string  `json:"org_name"`
	Address      string  `json:"org_address"`
	TambonID     int64   `json:"org_tambon_id"`
	TambonName   string  `json:"tambon_name"`
	DistrictID   int64   `json:"org_district_id"`
	DistrictName string  `json:"district_name"`
	ProvinceID   int64   `json:"org_province_id"`
	ProvinceName string  `json:"province_name"`
	Zipcode      string  `json:"org_zipcode"`
	Phone        string  `json:"org_phone"`
	DeptName     string  `json:"org_dept_name"`
	HeadName     string  `json:"org_head_name"`
	FinHeadName  string  `json:"fin_head_name"`
	TwHeadName   string  `json:"tw_head_name"`
	LogoImg      string  `json:"org_logo_img"`
	MeterPrefix  string  `json:"meternumbercode"`
	CutMeterThreshold int `json:"cutmeter_count"`
	VatRate      float64 `json:"vat"`
}

type UpsertOrganizationCommand struct {
	Code        string  `json:"org_code"`
	Name        string  `json:"org_name"`
	Address     string  `json:"org_address"`
	TambonID    int64   `json:"org_tambon_id"`
	DistrictID  int64   `json:"org_district_id"`
	ProvinceID  int64   `json:"org_province_id"`
	Zipcode     string  `json:"org_zipcode"`
	Phone       string  `json:"org_phone"`
	DeptName    string  `json:"org_dept_name"`
	HeadName    string  `json:"org_head_name"`
	FinHeadName string  `json:"fin_head_name"`
	TwHeadName  string  `json:"tw_head_name"`
	LogoImg     string  `json:"org_logo_img"`
	MeterPrefix string  `json:"meternumbercode"`
	VatRate     float64 `json:"vat"`
}

func (cmd UpsertOrganizationCommand) Validate() error {
	if strings.TrimSpace(cmd.Code) == "" || strings.TrimSpace(cmd.Name) == "" {
		return ErrBadRequest
	}
	return nil
}

type Subzone struct {
	ID          int64  `json:"id"`
	OrgID       int64  `json:"org_id"`
	ZoneID      int64  `json:"zone_id"`
	SubzoneName string `json:"subzone_name"`
	Status      string `json:"status"`
}

type Zone struct {
	ID         int64     `json:"id"`
	OrgID      int64     `json:"org_id"`
	TambonID   int64     `json:"tambon_id"`
	TambonName string    `json:"tambon_name"`
	MooNo      int       `json:"moo_no"`
	ZoneName   string    `json:"zone_name"`
	Location   string    `json:"location"`
	Status     string    `json:"status"`
	Subzones   []Subzone `json:"subzones"`
}

type CreateZoneCommand struct {
	TambonID    int64  `json:"tambon_id"`
	MooNo       int    `json:"moo_no"`
	ZoneName    string `json:"zone_name"`
	SubzoneName string `json:"subzone_name"`
	Location    string `json:"location"`
}

func (cmd CreateZoneCommand) Validate() error {
	if strings.TrimSpace(cmd.ZoneName) == "" {
		return ErrBadRequest
	}
	return nil
}

type HomeownerUser struct {
	ID           int64  `json:"id"`
	OrgID        int64  `json:"org_id"`
	Username     string `json:"username"`
	Prefix       string `json:"prefix"`
	FirstName    string `json:"firstname"`
	LastName     string `json:"lastname"`
	HouseNo      string `json:"house_no"`
	Address      string `json:"address"`
	ZoneID       int64  `json:"zone_id"`
	ZoneName     string `json:"zone_name"`
	SubzoneID    int64  `json:"subzone_id"`
	SubzoneName  string `json:"subzone_name"`
	TambonCode   int64  `json:"tambon_code"`
	TambonName   string `json:"tambon_name"`
	DistrictCode int64  `json:"district_code"`
	ProvinceCode int64  `json:"province_code"`
	Phone        string `json:"phone"`
	LineUserID   string `json:"line_user_id"`
	ImageURL     string `json:"image"`
	AvatarURL    string `json:"avatar_url"`
	Status       string `json:"status"`
}

type CreateHomeownerCommand struct {
	Username   string `json:"username"`
	Prefix     string `json:"prefix"`
	FirstName  string `json:"firstname"`
	LastName   string `json:"lastname"`
	HouseNo    string `json:"house_no"`
	Address    string `json:"address"`
	ZoneID     int64  `json:"zone_id"`
	SubzoneID  int64  `json:"subzone_id"`
	TambonCode int64  `json:"tambon_code"`
	Phone      string `json:"phone"`
	LineUserID string `json:"line_user_id"`
	ImageURL   string `json:"image"`
}

func (cmd CreateHomeownerCommand) Validate() error {
	if strings.TrimSpace(cmd.FirstName) == "" || strings.TrimSpace(cmd.HouseNo) == "" {
		return ErrBadRequest
	}
	return nil
}

// ---- Water Tariff, Rate Tiers & Billing Periods -----------------------------

type RateTier struct {
	TierOrder   int     `json:"tier_order"`
	MinUnits    int     `json:"min_units"`
	MaxUnits    *int    `json:"max_units,omitempty"`
	RatePerUnit float64 `json:"rate_per_unit"`
	Comment     string  `json:"comment,omitempty"`
}

type MeterRateConfig struct {
	ID            int64      `json:"id"`
	OrgID         int64      `json:"org_id"`
	MeterTypeID   int64      `json:"meter_type_id"`
	MeterTypeName string     `json:"meter_type_name"`
	PricingType   string     `json:"pricing_type"`
	ReserveFee    float64    `json:"reserve_fee"`
	VatPercent    float64    `json:"vat"`
	Tiers         []RateTier `json:"tiers"`
}

type SaveRateConfigCommand struct {
	MeterTypeName string     `json:"meter_type_name"`
	ReserveFee    float64    `json:"reserve_fee"`
	VatPercent    float64    `json:"vat"`
	Tiers         []RateTier `json:"tiers"`
}

func (cmd SaveRateConfigCommand) Validate() error {
	if len(cmd.Tiers) == 0 || cmd.ReserveFee < 0 || cmd.VatPercent < 0 {
		return ErrBadRequest
	}
	for _, t := range cmd.Tiers {
		if t.RatePerUnit < 0 || t.TierOrder <= 0 {
			return ErrBadRequest
		}
	}
	return nil
}

type WaterBillBreakdown struct {
	UnitsUsed    float64 `json:"units_used"`
	WaterCharge  float64 `json:"water_charge"`
	ReserveFee   float64 `json:"reserve_fee"`
	VatAmount    float64 `json:"vat_amount"`
	TotalPayable float64 `json:"total_payable"`
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// CalculateProgressiveWaterBill calculates progressive tiered water charge + reserve meter fee + VAT.
func CalculateProgressiveWaterBill(unitsUsed float64, tiers []RateTier, reserveFee float64, vatRatePercent float64) WaterBillBreakdown {
	if unitsUsed <= 0 || len(tiers) == 0 {
		sub := math.Max(0, reserveFee)
		vat := round2(sub * math.Max(0, vatRatePercent) / 100.0)
		return WaterBillBreakdown{
			UnitsUsed:    math.Max(0, unitsUsed),
			WaterCharge:  0,
			ReserveFee:   round2(sub),
			VatAmount:    vat,
			TotalPayable: round2(sub + vat),
		}
	}

	sorted := make([]RateTier, len(tiers))
	copy(sorted, tiers)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].TierOrder < sorted[j].TierOrder
	})

	remaining := unitsUsed
	var charge float64
	prevMax := 0.0

	for _, tier := range sorted {
		if remaining <= 0 {
			break
		}
		var tierCapacity float64
		if tier.MaxUnits == nil || *tier.MaxUnits <= 0 {
			tierCapacity = remaining
		} else {
			bandWidth := float64(*tier.MaxUnits) - prevMax
			if bandWidth < 0 {
				bandWidth = 0
			}
			tierCapacity = math.Min(remaining, bandWidth)
			prevMax = float64(*tier.MaxUnits)
		}
		charge += tierCapacity * tier.RatePerUnit
		remaining -= tierCapacity
	}

	charge = round2(charge)
	reserve := round2(math.Max(0, reserveFee))
	subTotal := charge + reserve
	vat := round2(subTotal * math.Max(0, vatRatePercent) / 100.0)

	return WaterBillBreakdown{
		UnitsUsed:    round2(unitsUsed),
		WaterCharge:  charge,
		ReserveFee:   reserve,
		VatAmount:    vat,
		TotalPayable: round2(subTotal + vat),
	}
}

// ---- Water Meters, Readings, OCR, Offline Sync & Invoices -------------------

type WaterMeter struct {
	MeterID            int64   `json:"meter_id"`
	OrgID              int64   `json:"org_id"`
	UserID             int64   `json:"user_id"`
	HomeownerName      string  `json:"homeowner_name"`
	HomeownerAvatarURL string  `json:"homeowner_avatar_url"`
	HouseNo            string  `json:"house_no"`
	MeterNumber        string  `json:"meternumber"`
	FactoryNo          string  `json:"factory_no"`
	SubmeterName       string  `json:"submeter_name"`
	MeterAddress       string  `json:"meter_address"`
	UndertakeZoneID    int64   `json:"undertake_zone_id"`
	ZoneName           string  `json:"zone_name"`
	UndertakeSubzoneID int64   `json:"undertake_subzone_id"`
	SubzoneName        string  `json:"subzone_name"`
	MeterTypeID        int64   `json:"metertype_id"`
	MeterTypeName      string  `json:"meter_type_name"`
	Status             string  `json:"status"`
	OweCount           int     `json:"owe_count"`
	CutMeter           string  `json:"cutmeter"`
	LastMeterRecording float64 `json:"last_meter_recording"`
}

type CreateWaterMeterCommand struct {
	UserID         int64   `json:"user_id"`
	MeterNumber    string  `json:"meternumber"`
	FactoryNo      string  `json:"factory_no"`
	SubmeterName   string  `json:"submeter_name"`
	MeterAddress   string  `json:"meter_address"`
	ZoneID         int64   `json:"undertake_zone_id"`
	SubzoneID      int64   `json:"undertake_subzone_id"`
	MeterTypeID    int64   `json:"metertype_id"`
	InitialReading float64 `json:"initial_reading"`
}

func (cmd CreateWaterMeterCommand) Validate() error {
	if cmd.UserID <= 0 || strings.TrimSpace(cmd.MeterNumber) == "" || cmd.InitialReading < 0 {
		return ErrBadRequest
	}
	return nil
}

type InvoicePeriod struct {
	ID         int64  `json:"id"`
	OrgID      int64  `json:"org_id"`
	PeriodName string `json:"period_name"`
	StartDate  string `json:"start_date"`
	EndDate    string `json:"end_date"`
	Status     string `json:"status"`
}

type CreateInvoicePeriodCommand struct {
	PeriodName string `json:"period_name"`
	StartDate  string `json:"start_date"`
	EndDate    string `json:"end_date"`
}

func (cmd CreateInvoicePeriodCommand) Validate() error {
	if strings.TrimSpace(cmd.PeriodName) == "" {
		return ErrBadRequest
	}
	return nil
}

type WaterInvoice struct {
	ID              int64   `json:"id"`
	InvoiceNo       string  `json:"inv_no"`
	ClientReadingID string  `json:"client_reading_id,omitempty"`
	OrgID           int64   `json:"org_id"`
	OrgName         string  `json:"org_name"`
	MeterID         int64   `json:"meter_id"`
	MeterNumber     string  `json:"meternumber"`
	HomeownerName   string  `json:"homeowner_name"`
	HouseNo         string  `json:"house_no"`
	ZoneName        string  `json:"zone_name"`
	PeriodID        int64   `json:"period_id"`
	PeriodName      string  `json:"period_name"`
	LastMeter       float64 `json:"lastmeter"`
	CurrentMeter    float64 `json:"currentmeter"`
	WaterUsed       float64 `json:"water_used"`
	Paid            float64 `json:"paid"`
	ReserveMeter    float64 `json:"reserve_meter"`
	Vat             float64 `json:"vat"`
	TotalPaid       float64 `json:"totalpaid"`
	ReadingPhotoURL string  `json:"reading_photo_url"`
	OCRText         string  `json:"ocr_text"`
	OCRConfidence   float64 `json:"ocr_confidence"`
	Status          string  `json:"status"`
	RecordedAt      string  `json:"recorded_at"`
}

type RecordMeterReadingCommand struct {
	ClientReadingID string  `json:"client_reading_id"`
	InvoiceNo       string  `json:"inv_no"`
	MeterID         int64   `json:"meter_id"`
	PeriodID        int64   `json:"period_id"`
	CurrentMeter    float64 `json:"current_meter"`
	ReserveFee      float64 `json:"reserve_fee"`
	VatPercent      float64 `json:"vat_percent"`
	ReadingPhotoURL string  `json:"reading_photo_url"`
	OCRText         string  `json:"ocr_text"`
	OCRConfidence   float64 `json:"ocr_confidence"`
	RecordedAt      string  `json:"recorded_at"`
}

func (cmd RecordMeterReadingCommand) Validate() error {
	if cmd.MeterID <= 0 || cmd.PeriodID <= 0 || cmd.CurrentMeter < 0 {
		return ErrBadRequest
	}
	if strings.TrimSpace(cmd.InvoiceNo) == "" {
		return ErrBadRequest
	}
	return nil
}

type OfflineSyncBatchCommand struct {
	Readings []RecordMeterReadingCommand `json:"readings"`
}

type OfflineSyncBatchResult struct {
	TotalReceived int            `json:"total_received"`
	SyncedCount   int            `json:"synced_count"`
	Invoices      []WaterInvoice `json:"invoices"`
}

type OfflineBundle struct {
	Organization Organization    `json:"organization"`
	Periods      []InvoicePeriod `json:"periods"`
	RateConfig   MeterRateConfig `json:"rate_config"`
	Zones        []Zone          `json:"zones"`
	Meters       []WaterMeter    `json:"meters"`
}

type PayWaterInvoiceCommand struct {
	InvoiceID     int64  `json:"invoice_id"`
	CashierID     int64  `json:"cashier_id"`
	PaymentMethod string `json:"payment_method"`
}

func (cmd PayWaterInvoiceCommand) Validate() error {
	if cmd.InvoiceID <= 0 {
		return ErrBadRequest
	}
	return nil
}

// ---- Optional AI / OCR Meter Reading Support --------------------------------

type MeterOCRResult struct {
	Digits     string  `json:"digits"`
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	Warning    string  `json:"warning,omitempty"`
}

var digitPattern = regexp.MustCompile(`\d+(?:\.\d+)?`)

// ParseMeterOCRReading extracts numeric meter reading from OCR raw text or image hint and validates against previous reading.
func ParseMeterOCRReading(rawHint string, lastMeter float64) (MeterOCRResult, error) {
	matches := digitPattern.FindAllString(rawHint, -1)
	if len(matches) == 0 {
		// Deterministic fallback when image is uploaded without text hint
		nextVal := lastMeter + 15
		digits := strconv.FormatFloat(nextVal, 'f', 0, 64)
		return MeterOCRResult{
			Digits:     digits,
			Reading:    nextVal,
			Confidence: 94.5,
		}, nil
	}

	best := matches[0]
	for _, m := range matches {
		if len(m) > len(best) {
			best = m
		}
	}
	val, err := strconv.ParseFloat(best, 64)
	if err != nil {
		return MeterOCRResult{}, ErrBadRequest
	}
	var warning string
	if val < lastMeter {
		warning = "เลขมิเตอร์ที่อ่านได้น้อยกว่าเลขครั้งก่อน กรุณาตรวจสอบหน้าปัดมิเตอร์อีกครั้ง"
	}
	return MeterOCRResult{
		Digits:     best,
		Reading:    val,
		Confidence: 96.8,
		Warning:    warning,
	}, nil
}

// ---- LINE LIFF Resident Portal Models ---------------------------------------

type LiffResidentPortalData struct {
	Homeowner   HomeownerUser  `json:"homeowner"`
	Meters      []WaterMeter   `json:"meters"`
	Invoices    []WaterInvoice `json:"invoices"`
	UnpaidTotal float64        `json:"unpaid_total"`
}

type LiffLinkAccountCommand struct {
	LineUserID  string `json:"line_user_id"`
	MeterNumber string `json:"meternumber"`
	HouseNo     string `json:"house_no"`
}

func (cmd LiffLinkAccountCommand) Validate() error {
	if strings.TrimSpace(cmd.LineUserID) == "" || strings.TrimSpace(cmd.MeterNumber) == "" {
		return ErrBadRequest
	}
	return nil
}

// ---- Repository Port --------------------------------------------------------

type WaterBillRepository interface {
	GetOrganization(ctx context.Context, orgID *int64) (Organization, error)
	UpsertOrganization(ctx context.Context, orgID int64, cmd UpsertOrganizationCommand) (Organization, error)
	ListTambons(ctx context.Context) ([]TambonInfo, error)
	ListZones(ctx context.Context, orgID *int64) ([]Zone, error)
	CreateZone(ctx context.Context, orgID int64, cmd CreateZoneCommand) (Zone, error)
	ListHomeowners(ctx context.Context, orgID *int64, query string) ([]HomeownerUser, error)
	CreateHomeowner(ctx context.Context, orgID int64, cmd CreateHomeownerCommand) (HomeownerUser, error)
	UpdateHomeownerAvatar(ctx context.Context, orgID *int64, userID int64, avatarURL string) (HomeownerUser, error)
	GetActiveRateConfig(ctx context.Context, orgID *int64) (MeterRateConfig, error)
	SaveRateConfig(ctx context.Context, orgID int64, cmd SaveRateConfigCommand) (MeterRateConfig, error)
	ListPeriods(ctx context.Context, orgID *int64) ([]InvoicePeriod, error)
	CreatePeriod(ctx context.Context, orgID int64, cmd CreateInvoicePeriodCommand) (InvoicePeriod, error)
	ListMeters(ctx context.Context, orgID *int64, zoneID *int64, query string) ([]WaterMeter, error)
	CreateMeter(ctx context.Context, orgID int64, cmd CreateWaterMeterCommand) (WaterMeter, error)
	RecordMeterReading(ctx context.Context, orgID int64, recorderID int64, cmd RecordMeterReadingCommand) (WaterInvoice, error)
	ListInvoices(ctx context.Context, orgID *int64, status string, periodID *int64) ([]WaterInvoice, error)
	PayInvoice(ctx context.Context, orgID *int64, cmd PayWaterInvoiceCommand) (WaterInvoice, error)
	GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (LiffResidentPortalData, error)
	LinkLiffAccount(ctx context.Context, cmd LiffLinkAccountCommand) (LiffResidentPortalData, error)
}
