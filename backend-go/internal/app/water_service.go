package app

import (
	"context"

	"github.com/pobx/water-smart-bill/backend-go/internal/domain"
)

type WaterService struct {
	repo domain.WaterBillRepository
}

func NewWaterService(repo domain.WaterBillRepository) *WaterService {
	return &WaterService{repo: repo}
}

func resolveTenantOrgID(claims domain.Claims, requested *int64) (int64, *int64, error) {
	scoped, err := claims.ResolveOrgScope(requested)
	if err != nil {
		return 0, nil, err
	}
	if scoped != nil {
		return *scoped, scoped, nil
	}
	return 1, nil, nil
}

func (s *WaterService) GetOrganization(ctx context.Context, claims domain.Claims) (domain.Organization, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.Organization{}, err
	}
	return s.repo.GetOrganization(ctx, scoped)
}

func (s *WaterService) UpsertOrganization(ctx context.Context, claims domain.Claims, cmd domain.UpsertOrganizationCommand) (domain.Organization, error) {
	if err := cmd.Validate(); err != nil {
		return domain.Organization{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.Organization{}, err
	}
	return s.repo.UpsertOrganization(ctx, orgID, cmd)
}

func (s *WaterService) ListTambons(ctx context.Context) ([]domain.TambonInfo, error) {
	return s.repo.ListTambons(ctx)
}

func (s *WaterService) ListZones(ctx context.Context, claims domain.Claims) ([]domain.Zone, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.repo.ListZones(ctx, scoped)
}

func (s *WaterService) CreateZone(ctx context.Context, claims domain.Claims, cmd domain.CreateZoneCommand) (domain.Zone, error) {
	if err := cmd.Validate(); err != nil {
		return domain.Zone{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.Zone{}, err
	}
	return s.repo.CreateZone(ctx, orgID, cmd)
}

func (s *WaterService) ListHomeowners(ctx context.Context, claims domain.Claims, query string) ([]domain.HomeownerUser, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.repo.ListHomeowners(ctx, scoped, query)
}

func (s *WaterService) CreateHomeowner(ctx context.Context, claims domain.Claims, cmd domain.CreateHomeownerCommand) (domain.HomeownerUser, error) {
	if err := cmd.Validate(); err != nil {
		return domain.HomeownerUser{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.HomeownerUser{}, err
	}
	return s.repo.CreateHomeowner(ctx, orgID, cmd)
}

func (s *WaterService) UpdateHomeownerAvatar(ctx context.Context, claims domain.Claims, userID int64, avatarURL string) (domain.HomeownerUser, error) {
	if userID <= 0 {
		return domain.HomeownerUser{}, domain.ErrBadRequest
	}
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.HomeownerUser{}, err
	}
	return s.repo.UpdateHomeownerAvatar(ctx, scoped, userID, avatarURL)
}

func (s *WaterService) GetActiveRateConfig(ctx context.Context, claims domain.Claims) (domain.MeterRateConfig, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.MeterRateConfig{}, err
	}
	return s.repo.GetActiveRateConfig(ctx, scoped)
}

func (s *WaterService) SaveRateConfig(ctx context.Context, claims domain.Claims, cmd domain.SaveRateConfigCommand) (domain.MeterRateConfig, error) {
	if err := cmd.Validate(); err != nil {
		return domain.MeterRateConfig{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.MeterRateConfig{}, err
	}
	return s.repo.SaveRateConfig(ctx, orgID, cmd)
}

func (s *WaterService) ListPeriods(ctx context.Context, claims domain.Claims) ([]domain.InvoicePeriod, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.repo.ListPeriods(ctx, scoped)
}

func (s *WaterService) CreatePeriod(ctx context.Context, claims domain.Claims, cmd domain.CreateInvoicePeriodCommand) (domain.InvoicePeriod, error) {
	if err := cmd.Validate(); err != nil {
		return domain.InvoicePeriod{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.InvoicePeriod{}, err
	}
	return s.repo.CreatePeriod(ctx, orgID, cmd)
}

func (s *WaterService) ListMeters(ctx context.Context, claims domain.Claims, zoneID *int64, query string) ([]domain.WaterMeter, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.repo.ListMeters(ctx, scoped, zoneID, query)
}

func (s *WaterService) CreateMeter(ctx context.Context, claims domain.Claims, cmd domain.CreateWaterMeterCommand) (domain.WaterMeter, error) {
	if err := cmd.Validate(); err != nil {
		return domain.WaterMeter{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.WaterMeter{}, err
	}
	return s.repo.CreateMeter(ctx, orgID, cmd)
}

func (s *WaterService) RecordMeterReading(ctx context.Context, claims domain.Claims, cmd domain.RecordMeterReadingCommand) (domain.WaterInvoice, error) {
	if err := cmd.Validate(); err != nil {
		return domain.WaterInvoice{}, err
	}
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.WaterInvoice{}, err
	}
	return s.repo.RecordMeterReading(ctx, orgID, 1, cmd)
}

func (s *WaterService) SyncOfflineReadings(ctx context.Context, claims domain.Claims, batch domain.OfflineSyncBatchCommand) (domain.OfflineSyncBatchResult, error) {
	orgID, _, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.OfflineSyncBatchResult{}, err
	}
	res := domain.OfflineSyncBatchResult{
		TotalReceived: len(batch.Readings),
		Invoices:      []domain.WaterInvoice{},
	}
	for _, r := range batch.Readings {
		if err := r.Validate(); err != nil {
			return domain.OfflineSyncBatchResult{}, err
		}
		inv, err := s.repo.RecordMeterReading(ctx, orgID, 1, r)
		if err != nil {
			return domain.OfflineSyncBatchResult{}, err
		}
		res.SyncedCount++
		res.Invoices = append(res.Invoices, inv)
	}
	return res, nil
}

func (s *WaterService) GetOfflineBundle(ctx context.Context, claims domain.Claims, zoneID *int64) (domain.OfflineBundle, error) {
	org, err := s.GetOrganization(ctx, claims)
	if err != nil {
		return domain.OfflineBundle{}, err
	}
	periods, err := s.ListPeriods(ctx, claims)
	if err != nil {
		return domain.OfflineBundle{}, err
	}
	rateCfg, err := s.GetActiveRateConfig(ctx, claims)
	if err != nil {
		return domain.OfflineBundle{}, err
	}
	zones, err := s.ListZones(ctx, claims)
	if err != nil {
		return domain.OfflineBundle{}, err
	}
	meters, err := s.ListMeters(ctx, claims, zoneID, "")
	if err != nil {
		return domain.OfflineBundle{}, err
	}
	return domain.OfflineBundle{
		Organization: org,
		Periods:      periods,
		RateConfig:   rateCfg,
		Zones:        zones,
		Meters:       meters,
	}, nil
}

func (s *WaterService) ListInvoices(ctx context.Context, claims domain.Claims, status string, periodID *int64) ([]domain.WaterInvoice, error) {
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return nil, err
	}
	return s.repo.ListInvoices(ctx, scoped, status, periodID)
}

func (s *WaterService) PayInvoice(ctx context.Context, claims domain.Claims, cmd domain.PayWaterInvoiceCommand) (domain.WaterInvoice, error) {
	if err := cmd.Validate(); err != nil {
		return domain.WaterInvoice{}, err
	}
	_, scoped, err := resolveTenantOrgID(claims, nil)
	if err != nil {
		return domain.WaterInvoice{}, err
	}
	return s.repo.PayInvoice(ctx, scoped, cmd)
}

func (s *WaterService) GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (domain.LiffResidentPortalData, error) {
	return s.repo.GetLiffPortalData(ctx, lineUserID, meterNumber, houseNo)
}

func (s *WaterService) LinkLiffAccount(ctx context.Context, cmd domain.LiffLinkAccountCommand) (domain.LiffResidentPortalData, error) {
	if err := cmd.Validate(); err != nil {
		return domain.LiffResidentPortalData{}, err
	}
	return s.repo.LinkLiffAccount(ctx, cmd)
}
