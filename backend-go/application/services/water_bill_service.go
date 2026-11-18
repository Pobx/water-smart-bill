package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/application"
	"github.com/pobx/water-smart-bill/backend-go/application/ports"
)

// WaterBillService implements ports.WaterBillServiceInterface.
type WaterBillService struct {
	Repository ports.WaterBillRepositoryInterface
}

func NewWaterBillService(repo ports.WaterBillRepositoryInterface) *WaterBillService {
	return &WaterBillService{Repository: repo}
}

func resolveTenantOrgID(claims application.Claims, requested *int64) (int64, *int64, error) {
	scoped, err := claims.ResolveOrgScope(requested)
	if err != nil {
		return 0, nil, err
	}
	if scoped != nil {
		return *scoped, scoped, nil
	}
	return 1, nil, nil
}

func (s *WaterBillService) GetOrganization(ctx context.Context, claims application.Claims) (application.Organization, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.Organization{}, err
	}
	return s.Repository.GetOrganization(ctx, scoped)
}

func (s *WaterBillService) UpsertOrganization(ctx context.Context, claims application.Claims, cmd application.UpsertOrganizationCommand) (application.Organization, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.Organization{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.Organization{}, err
	}
	return s.Repository.UpsertOrganization(ctx, orgID, cmd)
}

func (s *WaterBillService) ListTambons(ctx context.Context) ([]application.TambonInfo, error) {
	return s.Repository.ListTambons(ctx)
}

func (s *WaterBillService) ListZones(ctx context.Context, claims application.Claims) ([]application.Zone, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.Repository.ListZones(ctx, scoped)
}

func (s *WaterBillService) CreateZone(ctx context.Context, claims application.Claims, cmd application.CreateZoneCommand) (application.Zone, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.Zone{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.Zone{}, err
	}
	return s.Repository.CreateZone(ctx, orgID, cmd)
}

func (s *WaterBillService) ListHomeowners(ctx context.Context, claims application.Claims, query string) ([]application.HomeownerUser, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.Repository.ListHomeowners(ctx, scoped, query)
}

func (s *WaterBillService) CreateHomeowner(ctx context.Context, claims application.Claims, cmd application.CreateHomeownerCommand) (application.HomeownerUser, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.HomeownerUser{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.HomeownerUser{}, err
	}
	return s.Repository.CreateHomeowner(ctx, orgID, cmd)
}

func (s *WaterBillService) UpdateHomeownerAvatar(ctx context.Context, claims application.Claims, userID int64, avatarURL string) (application.HomeownerUser, error) {
	if userID <= 0 {
		return application.HomeownerUser{}, application.ErrBadRequest
	}
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.HomeownerUser{}, err
	}
	return s.Repository.UpdateHomeownerAvatar(ctx, scoped, userID, avatarURL)
}

func (s *WaterBillService) GetActiveRateConfig(ctx context.Context, claims application.Claims) (application.MeterRateConfig, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	return s.Repository.GetActiveRateConfig(ctx, scoped)
}

func (s *WaterBillService) SaveRateConfig(ctx context.Context, claims application.Claims, cmd application.SaveRateConfigCommand) (application.MeterRateConfig, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.MeterRateConfig{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	return s.Repository.SaveRateConfig(ctx, orgID, cmd)
}

func (s *WaterBillService) ListPeriods(ctx context.Context, claims application.Claims) ([]application.InvoicePeriod, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.Repository.ListPeriods(ctx, scoped)
}

func (s *WaterBillService) CreatePeriod(ctx context.Context, claims application.Claims, cmd application.CreateInvoicePeriodCommand) (application.InvoicePeriod, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.InvoicePeriod{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.InvoicePeriod{}, err
	}
	return s.Repository.CreatePeriod(ctx, orgID, cmd)
}

func (s *WaterBillService) ListMeters(ctx context.Context, claims application.Claims, zoneID *int64, query string) ([]application.WaterMeter, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.Repository.ListMeters(ctx, scoped, zoneID, query)
}

func (s *WaterBillService) CreateMeter(ctx context.Context, claims application.Claims, cmd application.CreateWaterMeterCommand) (application.WaterMeter, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.WaterMeter{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.WaterMeter{}, err
	}
	return s.Repository.CreateMeter(ctx, orgID, cmd)
}

func (s *WaterBillService) RecordMeterReading(ctx context.Context, claims application.Claims, cmd application.RecordMeterReadingCommand) (application.WaterInvoice, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.WaterInvoice{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.WaterInvoice{}, err
	}
	return s.Repository.RecordMeterReading(ctx, orgID, 1, cmd)
}

func (s *WaterBillService) SyncOfflineReadings(ctx context.Context, claims application.Claims, batch application.OfflineSyncBatchCommand) (application.OfflineSyncBatchResult, error) {
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.OfflineSyncBatchResult{}, err
	}
	res := application.OfflineSyncBatchResult{
		TotalReceived: len(batch.Readings),
		Invoices:      []application.WaterInvoice{},
	}
	for _, r := range batch.Readings {
		if _, err := r.IsValid(); err != nil {
			return application.OfflineSyncBatchResult{}, err
		}
		inv, err := s.Repository.RecordMeterReading(ctx, orgID, 1, r)
		if err != nil {
			return application.OfflineSyncBatchResult{}, err
		}
		res.SyncedCount++
		res.Invoices = append(res.Invoices, inv)
	}
	return res, nil
}

func (s *WaterBillService) GetOfflineBundle(ctx context.Context, claims application.Claims, zoneID *int64) (application.OfflineBundle, error) {
	org, err := s.GetOrganization(ctx, claims)
	if err != nil {
		return application.OfflineBundle{}, err
	}
	periods, err := s.ListPeriods(ctx, claims)
	if err != nil {
		return application.OfflineBundle{}, err
	}
	rateCfg, err := s.GetActiveRateConfig(ctx, claims)
	if err != nil {
		return application.OfflineBundle{}, err
	}
	zones, err := s.ListZones(ctx, claims)
	if err != nil {
		return application.OfflineBundle{}, err
	}
	meters, err := s.ListMeters(ctx, claims, zoneID, "")
	if err != nil {
		return application.OfflineBundle{}, err
	}
	return application.OfflineBundle{
		Organization: org,
		Periods:      periods,
		RateConfig:   rateCfg,
		Zones:        zones,
		Meters:       meters,
	}, nil
}

func (s *WaterBillService) ListInvoices(ctx context.Context, claims application.Claims, status string, periodID *int64) ([]application.WaterInvoice, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.Repository.ListInvoices(ctx, scoped, status, periodID)
}

func (s *WaterBillService) PayInvoice(ctx context.Context, claims application.Claims, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.WaterInvoice{}, err
	}
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return application.WaterInvoice{}, err
	}
	return s.Repository.PayInvoice(ctx, scoped, cmd)
}

func (s *WaterBillService) GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error) {
	return s.Repository.GetLiffPortalData(ctx, lineUserID, meterNumber, houseNo)
}

func (s *WaterBillService) LinkLiffAccount(ctx context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error) {
	if _, err := cmd.IsValid(); err != nil {
		return application.LiffResidentPortalData{}, err
	}
	return s.Repository.LinkLiffAccount(ctx, cmd)
}

func (s *WaterBillService) GetCollectionReport(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) (application.CollectionSummaryReport, error) {
	invoices, err := s.ListInvoices(ctx, claims, filter.Status, filter.PeriodID)
	if err != nil {
		return application.CollectionSummaryReport{}, err
	}

	report := application.CollectionSummaryReport{
		GeneratedAt: time.Now().Format(time.RFC3339),
		Invoices:    invoices,
	}
	if filter.PeriodID != nil {
		report.PeriodID = *filter.PeriodID
		report.PeriodName = fmt.Sprintf("งวดที่ %d", *filter.PeriodID)
	}

	for _, inv := range invoices {
		report.TotalInvoices++
		report.TotalUnitsUsed += int64(inv.WaterUsed)
		report.TotalWaterCharge += inv.Paid
		report.TotalReserveFee += inv.ReserveMeter
		report.TotalVatAmount += inv.Vat

		if strings.EqualFold(inv.Status, "paid") {
			report.PaidInvoices++
			report.TotalCollected += inv.TotalPaid
			if strings.EqualFold(inv.PaymentMethod, "cash") {
				report.TotalCash += inv.TotalPaid
			} else {
				report.TotalPromptPay += inv.TotalPaid
			}
		} else {
			report.UnpaidInvoices++
		}
	}

	return report, nil
}

func (s *WaterBillService) ExportCollectionReportCSV(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) ([]byte, error) {
	report, err := s.GetCollectionReport(ctx, claims, filter)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	// UTF-8 BOM for Thai text in Excel
	buf.WriteString("\xef\xbb\xbf")

	writer := csv.NewWriter(&buf)

	// Write header
	headers := []string{
		"เลขที่บิล",
		"รหัสมิเตอร์",
		"เลขครั้งก่อน",
		"เลขครั้งนี้",
		"หน่วยที่ใช้",
		"ค่าน้ำ (บาท)",
		"ค่ารักษามิเตอร์ (บาท)",
		"ภาษีมูลค่าเพิ่ม (บาท)",
		"ยอดรวมสุทธิ (บาท)",
		"สถานะ",
		"วิธีชำระเงิน",
		"เลขที่ใบเสร็จ",
		"วันที่ชำระเงิน",
	}
	if err := writer.Write(headers); err != nil {
		return nil, err
	}

	for _, inv := range report.Invoices {
		row := []string{
			inv.InvoiceNo,
			strconv.FormatInt(inv.MeterID, 10),
			strconv.FormatFloat(inv.LastMeter, 'f', 2, 64),
			strconv.FormatFloat(inv.CurrentMeter, 'f', 2, 64),
			strconv.FormatFloat(inv.WaterUsed, 'f', 2, 64),
			strconv.FormatFloat(inv.Paid, 'f', 2, 64),
			strconv.FormatFloat(inv.ReserveMeter, 'f', 2, 64),
			strconv.FormatFloat(inv.Vat, 'f', 2, 64),
			strconv.FormatFloat(inv.TotalPaid, 'f', 2, 64),
			inv.Status,
			inv.PaymentMethod,
			inv.ReceiptNo,
			inv.PaidAt,
		}
		if err := writer.Write(row); err != nil {
			return nil, err
		}
	}

	// Write summary row
	summaryRow := []string{
		"รวมทั้งสิ้น",
		fmt.Sprintf("จำนวน %d บิล", report.TotalInvoices),
		"-",
		"-",
		strconv.FormatInt(report.TotalUnitsUsed, 10),
		strconv.FormatFloat(report.TotalWaterCharge, 'f', 2, 64),
		strconv.FormatFloat(report.TotalReserveFee, 'f', 2, 64),
		strconv.FormatFloat(report.TotalVatAmount, 'f', 2, 64),
		strconv.FormatFloat(report.TotalCollected, 'f', 2, 64),
		fmt.Sprintf("ชำระแล้ว %d / ค้าง %d", report.PaidInvoices, report.UnpaidInvoices),
		fmt.Sprintf("เงินสด: %.2f | QR: %.2f", report.TotalCash, report.TotalPromptPay),
		"-",
		report.GeneratedAt,
	}
	_ = writer.Write(summaryRow)

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
