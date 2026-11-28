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
	PayInvoice(ctx context.Context, claims application.Claims, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error)
	GetCollectionReport(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) (application.CollectionSummaryReport, error)
	ExportCollectionReportCSV(ctx context.Context, claims application.Claims, filter application.CollectionReportFilter) ([]byte, error)
	GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error)
	LinkLiffAccount(ctx context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error)
}
