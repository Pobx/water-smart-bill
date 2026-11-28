package ports

import (
	"context"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

// WaterBillServiceInterface defines the Inbound Service Port for Water Smart Bill use cases.
type WaterBillServiceInterface interface {
	GetOrganization(ctx context.Context, claims application.Claims) (application.Organization, error)
	UpsertOrganization(ctx context.Context, claims application.Claims, cmd application.UpsertOrganizationCommand) (application.Organization, error)
	ListTambons(ctx context.Context) ([]application.TambonInfo, error)
	ListZones(ctx context.Context, claims application.Claims) ([]application.Zone, error)
	CreateZone(ctx context.Context, claims application.Claims, cmd application.CreateZoneCommand) (application.Zone, error)
	ListHomeowners(ctx context.Context, claims application.Claims, query string) ([]application.HomeownerUser, error)
	CreateHomeowner(ctx context.Context, claims application.Claims, cmd application.CreateHomeownerCommand) (application.HomeownerUser, error)
	UpdateHomeownerAvatar(ctx context.Context, claims application.Claims, userID int64, avatarURL string) (application.HomeownerUser, error)
	GetActiveRateConfig(ctx context.Context, claims application.Claims) (application.MeterRateConfig, error)
	SaveRateConfig(ctx context.Context, claims application.Claims, cmd application.SaveRateConfigCommand) (application.MeterRateConfig, error)
	UpdateRateConfig(ctx context.Context, claims application.Claims, configID int64, cmd application.UpdateRateConfigCommand) (application.MeterRateConfig, error)
	ListPeriods(ctx context.Context, claims application.Claims) ([]application.InvoicePeriod, error)
	CreatePeriod(ctx context.Context, claims application.Claims, cmd application.CreateInvoicePeriodCommand) (application.InvoicePeriod, error)
	ListMeters(ctx context.Context, claims application.Claims, zoneID *int64, query string) ([]application.WaterMeter, error)
	ListMeterRoutes(ctx context.Context, claims application.Claims, requestedOrgID *int64) ([]application.MeterRoute, error)
	CreateMeter(ctx context.Context, claims application.Claims, cmd application.CreateWaterMeterCommand) (application.WaterMeter, error)
	RecordMeterReading(ctx context.Context, claims application.Claims, cmd application.RecordMeterReadingCommand) (application.WaterInvoice, error)
	ListReadings(ctx context.Context, claims application.Claims, requestedOrgID *int64, filter application.MeterReadingFilter) ([]application.MeterReadingItem, error)
	SyncOfflineReadings(ctx context.Context, claims application.Claims, batch application.OfflineSyncBatchCommand) (application.OfflineSyncBatchResult, error)
	GetOfflineBundle(ctx context.Context, claims application.Claims, zoneID *int64) (application.OfflineBundle, error)
	ListInvoices(ctx context.Context, claims application.Claims, status string, periodID *int64) ([]application.WaterInvoice, error)
	GetOutstandingBalance(ctx context.Context, claims application.Claims, userID int64) (application.OutstandingBalance, error)
	PayInvoice(ctx context.Context, claims application.Claims, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error)
	PayInvoicesBulk(ctx context.Context, claims application.Claims, cmd application.BulkPaymentCommand) (application.PaymentBatchResult, error)
	CreateDebtNotice(ctx context.Context, claims application.Claims, cmd application.CreateDebtNoticeCommand) (application.DebtNotice, error)
	ListDebtNotices(ctx context.Context, claims application.Claims, filter application.DebtNoticeFilter) ([]application.DebtNotice, error)
	GetUserDebtNotices(ctx context.Context, claims application.Claims, userID int64) ([]application.DebtNotice, error)
	CutMeter(ctx context.Context, claims application.Claims, debtNoticeID string, cmd application.CutMeterCommand) (application.DebtNotice, error)
	RestoreMeter(ctx context.Context, claims application.Claims, debtNoticeID string) (application.DebtNotice, error)
	CreateIncident(ctx context.Context, claims application.Claims, cmd application.CreateIncidentCommand) (application.Incident, error)
	ListIncidents(ctx context.Context, claims application.Claims, filter application.IncidentFilter) ([]application.Incident, error)
	GetMyIncidents(ctx context.Context, claims application.Claims) ([]application.Incident, error)
	GetIncidentByID(ctx context.Context, claims application.Claims, id string) (application.Incident, error)
	AssignIncident(ctx context.Context, claims application.Claims, id string, cmd application.AssignIncidentCommand) (application.Incident, error)
	ResolveIncident(ctx context.Context, claims application.Claims, id string, cmd application.ResolveIncidentCommand) (application.Incident, error)
	GetCollectionReport(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) (application.CollectionSummaryReport, error)
	ExportCollectionReportCSV(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) ([]byte, error)
	GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error)
	LinkLiffAccount(ctx context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error)
}
