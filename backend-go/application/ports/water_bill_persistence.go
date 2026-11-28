package ports

import (
	"context"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

// WaterBillRepositoryInterface defines the Outbound Persistence Port for Water Smart Bill.
type WaterBillRepositoryInterface interface {
	GetOrganization(ctx context.Context, orgID *int64) (application.Organization, error)
	UpsertOrganization(ctx context.Context, orgID int64, cmd application.UpsertOrganizationCommand) (application.Organization, error)
	ListTambons(ctx context.Context) ([]application.TambonInfo, error)
	ListZones(ctx context.Context, orgID *int64) ([]application.Zone, error)
	CreateZone(ctx context.Context, orgID int64, cmd application.CreateZoneCommand) (application.Zone, error)
	ListHomeowners(ctx context.Context, orgID *int64, query string) ([]application.HomeownerUser, error)
	CreateHomeowner(ctx context.Context, orgID int64, cmd application.CreateHomeownerCommand) (application.HomeownerUser, error)
	UpdateHomeownerAvatar(ctx context.Context, orgID *int64, userID int64, avatarURL string) (application.HomeownerUser, error)
	GetActiveRateConfig(ctx context.Context, orgID *int64) (application.MeterRateConfig, error)
	SaveRateConfig(ctx context.Context, orgID int64, cmd application.SaveRateConfigCommand) (application.MeterRateConfig, error)
	ListPeriods(ctx context.Context, orgID *int64) ([]application.InvoicePeriod, error)
	CreatePeriod(ctx context.Context, orgID int64, cmd application.CreateInvoicePeriodCommand) (application.InvoicePeriod, error)
	ListMeters(ctx context.Context, orgID *int64, zoneID *int64, query string) ([]application.WaterMeter, error)
	FindMeterRoutes(ctx context.Context, orgID *int64) ([]application.MeterRoute, error)
	CreateMeter(ctx context.Context, orgID int64, cmd application.CreateWaterMeterCommand) (application.WaterMeter, error)
	RecordMeterReading(ctx context.Context, orgID int64, recorderID int64, cmd application.RecordMeterReadingCommand) (application.WaterInvoice, error)
	ListReadings(ctx context.Context, orgID *int64, filter application.MeterReadingFilter) ([]application.MeterReadingItem, error)
	ListInvoices(ctx context.Context, orgID *int64, status string, periodID *int64) ([]application.WaterInvoice, error)
	PayInvoice(ctx context.Context, orgID *int64, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error)
	GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error)
	LinkLiffAccount(ctx context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error)
}

// TokenVerifierInterface defines the Outbound Authentication Port for verifying OIDC JWT tokens.
type TokenVerifierInterface interface {
	VerifyAccessToken(ctx context.Context, rawToken string) (application.Claims, error)
}

// TokenBlacklistInterface defines the Outbound JWT Blacklist Port for revoking JWT tokens on logout.
type TokenBlacklistInterface interface {
	RevokeToken(ctx context.Context, jti string, expiresAt time.Time) error
	IsRevoked(ctx context.Context, jti string) (bool, error)
}
