package memory

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

func intPtr(v int) *int { return &v }

type Store struct {
	mu          sync.RWMutex
	org         application.Organization
	tambons     []application.TambonInfo
	zones       []application.Zone
	homeowners  []application.HomeownerUser
	rateConfig  application.MeterRateConfig
	periods     []application.InvoicePeriod
	meters         []application.WaterMeter
	meterRoutes    []application.MeterRoute
	invoices       []application.WaterInvoice
	paymentBatches map[string]application.PaymentBatchResult
	debtNotices     []application.DebtNotice
	nextDebtSeq     uint64
	incidents       []application.Incident
	nextIncidentSeq uint64
	nextZoneID      int64
	nextSubID   int64
	nextUserID  int64
	nextPeriod  int64
	nextMeterID int64
	nextInvID   int64
}

func NewStore() *Store {
	s := &Store{
		org: application.Organization{
			ID:                1,
			Code:              "HSG1",
			Name:              "องค์การบริหารส่วนตำบลห้องแซง",
			Address:           "99 หมู่ 1 ต.ห้องแซง อ.เลิงนกทา จ.ยโสธร",
			TambonID:          350805,
			TambonName:        "ห้องแซง",
			DistrictID:        3508,
			DistrictName:      "เลิงนกทา",
			ProvinceID:        35,
			ProvinceName:      "ยโสธร",
			Zipcode:           "35120",
			Phone:             "045-777-111",
			DeptName:          "กองการประปา อบต.ห้องแซง",
			HeadName:          "นายสมชาย รักท้องถิ่น",
			FinHeadName:       "นางสุดา การคลัง",
			TwHeadName:        "นายวิชัย ประปาดี",
			LogoImg:           "/api/v1/avatars/default?name=SAO",
			MeterPrefix:       "HSG",
			CutMeterThreshold: 3,
			OverdueThreshold:  2,
			VatRate:           7.0,
		},
		tambons: []application.TambonInfo{
			{
				TambonID:     350805,
				TambonName:   "ห้องแซง",
				DistrictID:   3508,
				DistrictName: "เลิงนกทา",
				ProvinceID:   35,
				ProvinceName: "ยโสธร",
				Zipcode:      "35120",
			},
			{
				TambonID:     470301,
				TambonName:   "เต่างอย",
				DistrictID:   4703,
				DistrictName: "เต่างอย",
				ProvinceID:   47,
				ProvinceName: "สกลนคร",
				Zipcode:      "47260",
			},
		},
		zones: []application.Zone{
			{
				ID:         1,
				OrgID:      1,
				TambonID:   350805,
				TambonName: "ห้องแซง",
				MooNo:      1,
				ZoneName:   "หมู่ที่ 1 บ้านห้องแซงเหนือ",
				Location:   "โซนเหนือ ต.ห้องแซง",
				Status:     "active",
				Subzones: []application.Subzone{
					{ID: 1, OrgID: 1, ZoneID: 1, SubzoneName: "สายจดที่ 1 (คุ้มวัดเหนือ)", Status: "active"},
				},
			},
			{
				ID:         2,
				OrgID:      1,
				TambonID:   350805,
				TambonName: "ห้องแซง",
				MooNo:      2,
				ZoneName:   "หมู่ที่ 2 บ้านห้องแซงใต้",
				Location:   "โซนใต้ ต.ห้องแซง",
				Status:     "active",
				Subzones: []application.Subzone{
					{ID: 2, OrgID: 1, ZoneID: 2, SubzoneName: "สายจดที่ 2 (คุ้มตลาดใต้)", Status: "active"},
				},
			},
		},
		homeowners: []application.HomeownerUser{
			{
				ID:           1,
				OrgID:        1,
				Username:     "sommai_01",
				Prefix:       "นาย",
				FirstName:    "สมหมาย",
				LastName:     "ใจดี",
				HouseNo:      "101/1",
				Address:      "101/1 หมู่ที่ 1 ต.ห้องแซง อ.เลิงนกทา จ.ยโสธร",
				ZoneID:       1,
				ZoneName:     "หมู่ที่ 1 บ้านห้องแซงเหนือ",
				SubzoneID:    1,
				SubzoneName:  "สายจดที่ 1 (คุ้มวัดเหนือ)",
				TambonCode:   350805,
				TambonName:   "ห้องแซง",
				DistrictCode: 3508,
				ProvinceCode: 35,
				Phone:        "081-234-5678",
				LineUserID:   "U1001_SOMMAI",
				ImageURL:     "",
				AvatarURL:    application.ResolveAvatarURL("", "สมหมาย", "ใจดี"),
				Status:       "active",
			},
			{
				ID:           2,
				OrgID:        1,
				Username:     "malee_02",
				Prefix:       "นาง",
				FirstName:    "มาลี",
				LastName:     "ศรีสุข",
				HouseNo:      "205/4",
				Address:      "205/4 หมู่ที่ 2 ต.ห้องแซง อ.เลิงนกทา จ.ยโสธร",
				ZoneID:       2,
				ZoneName:     "หมู่ที่ 2 บ้านห้องแซงใต้",
				SubzoneID:    2,
				SubzoneName:  "สายจดที่ 2 (คุ้มตลาดใต้)",
				TambonCode:   350805,
				TambonName:   "ห้องแซง",
				DistrictCode: 3508,
				ProvinceCode: 35,
				Phone:        "089-876-5432",
				LineUserID:   "U1002_MALEE",
				ImageURL:     "",
				AvatarURL:    application.ResolveAvatarURL("", "มาลี", "ศรีสุข"),
				Status:       "active",
			},
		},
		rateConfig: application.MeterRateConfig{
			ID:            1,
			OrgID:         1,
			MeterTypeID:   1,
			MeterTypeName: "ประปาครัวเรือน (4 หุน)",
			PricingType:   "progressive",
			ReserveFee:    10.0,
			VatPercent:    7.0,
			Tiers: []application.RateTier{
				{TierOrder: 1, MinUnits: 1, MaxUnits: intPtr(10), RatePerUnit: 5.0, Comment: "หน่วยที่ 1 - 10 (5 บาท/หน่วย)"},
				{TierOrder: 2, MinUnits: 11, MaxUnits: intPtr(20), RatePerUnit: 7.0, Comment: "หน่วยที่ 11 - 20 (7 บาท/หน่วย)"},
				{TierOrder: 3, MinUnits: 21, MaxUnits: intPtr(50), RatePerUnit: 10.0, Comment: "หน่วยที่ 21 - 50 (10 บาท/หน่วย)"},
				{TierOrder: 4, MinUnits: 51, MaxUnits: nil, RatePerUnit: 12.0, Comment: "ตั้งแต่ 51 หน่วยขึ้นไป (12 บาท/หน่วย)"},
			},
		},
		periods: []application.InvoicePeriod{
			{ID: 1, OrgID: 1, PeriodName: "11/2569", StartDate: "2026-11-01", EndDate: "2026-11-30", Status: "active"},
			{ID: 2, OrgID: 1, PeriodName: "10/2569", StartDate: "2026-10-01", EndDate: "2026-10-31", Status: "closed"},
		},
		meters: []application.WaterMeter{
			{
				MeterID:            1,
				OrgID:              1,
				UserID:             1,
				HomeownerName:      "นายสมหมาย ใจดี",
				HomeownerAvatarURL: application.ResolveAvatarURL("", "สมหมาย", "ใจดี"),
				HouseNo:            "101/1",
				MeterNumber:        "HSG-0001",
				FactoryNo:          "SN-2026-0001",
				SubmeterName:       "นายสมหมาย ใจดี",
				MeterAddress:       "101/1 หมู่ที่ 1 บ้านห้องแซงเหนือ",
				UndertakeZoneID:    1,
				ZoneName:           "หมู่ที่ 1 บ้านห้องแซงเหนือ",
				UndertakeSubzoneID: 1,
				SubzoneName:        "สายจดที่ 1 (คุ้มวัดเหนือ)",
				MeterTypeID:        1,
				MeterTypeName:      "ประปาครัวเรือน (4 หุน)",
				Status:             "active",
				OweCount:           1,
				CutMeter:           "0",
				LastMeterRecording: 120,
			},
			{
				MeterID:            2,
				OrgID:              1,
				UserID:             2,
				HomeownerName:      "นางมาลี ศรีสุข",
				HomeownerAvatarURL: application.ResolveAvatarURL("", "มาลี", "ศรีสุข"),
				HouseNo:            "205/4",
				MeterNumber:        "HSG-0002",
				FactoryNo:          "SN-2026-0002",
				SubmeterName:       "นางมาลี ศรีสุข",
				MeterAddress:       "205/4 หมู่ที่ 2 บ้านห้องแซงใต้",
				UndertakeZoneID:    2,
				ZoneName:           "หมู่ที่ 2 บ้านห้องแซงใต้",
				UndertakeSubzoneID: 2,
				SubzoneName:        "สายจดที่ 2 (คุ้มตลาดใต้)",
				MeterTypeID:        1,
				MeterTypeName:      "ประปาครัวเรือน (4 หุน)",
				Status:             "active",
				OweCount:           0,
				CutMeter:           "0",
				LastMeterRecording: 85,
			},
		},
		invoices: []application.WaterInvoice{
			{
				ID:              1,
				InvoiceNo:       "INV-2569-11-0001",
				ClientReadingID: "seed-uuid-0001",
				OrgID:           1,
				OrgName:         "องค์การบริหารส่วนตำบลห้องแซง",
				MeterID:         1,
				MeterNumber:     "HSG-0001",
				HomeownerName:   "นายสมหมาย ใจดี",
				HouseNo:         "101/1",
				ZoneName:        "หมู่ที่ 1 บ้านห้องแซงเหนือ",
				PeriodID:        1,
				PeriodName:      "11/2569",
				LastMeter:       105,
				CurrentMeter:    120,
				WaterUsed:       15,
				Paid:            85.00,
				ReserveMeter:    10.00,
				Vat:             6.65,
				TotalPaid:       101.65,
				ReadingPhotoURL: "",
				OCRText:         "00120",
				OCRConfidence:   98.2,
				Status:          "invoice",
				RecordedAt:      "2026-11-18T08:00:00Z",
			},
			{
				ID:              2,
				InvoiceNo:       "INV-2569-10-0002",
				ClientReadingID: "seed-uuid-0002",
				OrgID:           1,
				OrgName:         "องค์การบริหารส่วนตำบลห้องแซง",
				MeterID:         2,
				MeterNumber:     "HSG-0002",
				HomeownerName:   "นางมาลี ศรีสุข",
				HouseNo:         "205/4",
				ZoneName:        "หมู่ที่ 2 บ้านห้องแซงใต้",
				PeriodID:        2,
				PeriodName:      "10/2569",
				LastMeter:       75,
				CurrentMeter:    85,
				WaterUsed:       10,
				Paid:            50.00,
				ReserveMeter:    10.00,
				Vat:             4.20,
				TotalPaid:       64.20,
				ReadingPhotoURL: "",
				OCRText:         "00085",
				OCRConfidence:   99.0,
				Status:          "paid",
				RecordedAt:      "2026-10-25T09:30:00Z",
			},
		},
		paymentBatches: map[string]application.PaymentBatchResult{},
		debtNotices:     []application.DebtNotice{},
		nextDebtSeq:     1,
		incidents:       []application.Incident{},
		nextIncidentSeq: 1,
		nextZoneID:     3,
		nextSubID:   3,
		nextUserID:  3,
		nextPeriod:  3,
		nextMeterID: 3,
		nextInvID:   3,
	}
	return s
}

func (s *Store) GetOrganization(_ context.Context, _ *int64) (application.Organization, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.org, nil
}

func (s *Store) UpsertOrganization(_ context.Context, _ int64, cmd application.UpsertOrganizationCommand) (application.Organization, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.org.Code = strings.TrimSpace(cmd.Code)
	s.org.Name = strings.TrimSpace(cmd.Name)
	s.org.Address = strings.TrimSpace(cmd.Address)
	if cmd.TambonID > 0 {
		s.org.TambonID = cmd.TambonID
	}
	if cmd.Phone != "" {
		s.org.Phone = cmd.Phone
	}
	if cmd.DeptName != "" {
		s.org.DeptName = cmd.DeptName
	}
	if cmd.HeadName != "" {
		s.org.HeadName = cmd.HeadName
	}
	if cmd.FinHeadName != "" {
		s.org.FinHeadName = cmd.FinHeadName
	}
	if cmd.TwHeadName != "" {
		s.org.TwHeadName = cmd.TwHeadName
	}
	if cmd.MeterPrefix != "" {
		s.org.MeterPrefix = cmd.MeterPrefix
	}
	if cmd.VatRate > 0 {
		s.org.VatRate = cmd.VatRate
	}
	return s.org, nil
}

func (s *Store) ListTambons(_ context.Context) ([]application.TambonInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]application.TambonInfo, len(s.tambons))
	copy(out, s.tambons)
	return out, nil
}

func (s *Store) ListZones(_ context.Context, _ *int64) ([]application.Zone, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]application.Zone, len(s.zones))
	copy(out, s.zones)
	return out, nil
}

func (s *Store) SeedMeterRoutes(routes ...application.MeterRoute) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.meterRoutes = append([]application.MeterRoute(nil), routes...)
}

func (s *Store) FindMeterRoutes(_ context.Context, orgID *int64) ([]application.MeterRoute, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]application.MeterRoute, 0)
	for _, r := range s.meterRoutes {
		if orgID != nil && r.OrgID != *orgID {
			continue
		}
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name == out[j].Name {
			return out[i].ID < out[j].ID
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (s *Store) CreateZone(_ context.Context, orgID int64, cmd application.CreateZoneCommand) (application.Zone, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	zID := s.nextZoneID
	s.nextZoneID++
	subID := s.nextSubID
	s.nextSubID++
	subName := strings.TrimSpace(cmd.SubzoneName)
	if subName == "" {
		subName = "สายจดหลัก (" + strings.TrimSpace(cmd.ZoneName) + ")"
	}
	tambonID := cmd.TambonID
	if tambonID <= 0 {
		tambonID = 350805
	}
	moo := cmd.MooNo
	if moo <= 0 {
		moo = int(zID)
	}
	z := application.Zone{
		ID:         zID,
		OrgID:      orgID,
		TambonID:   tambonID,
		TambonName: "ห้องแซง",
		MooNo:      moo,
		ZoneName:   strings.TrimSpace(cmd.ZoneName),
		Location:   strings.TrimSpace(cmd.Location),
		Status:     "active",
		Subzones: []application.Subzone{
			{ID: subID, OrgID: orgID, ZoneID: zID, SubzoneName: subName, Status: "active"},
		},
	}
	s.zones = append(s.zones, z)
	return z, nil
}

func (s *Store) ListHomeowners(_ context.Context, _ *int64, query string) ([]application.HomeownerUser, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	q := strings.ToLower(strings.TrimSpace(query))
	var out []application.HomeownerUser
	for _, u := range s.homeowners {
		u.AvatarURL = application.ResolveAvatarURL(u.ImageURL, u.FirstName, u.LastName)
		if q == "" ||
			strings.Contains(strings.ToLower(u.FirstName), q) ||
			strings.Contains(strings.ToLower(u.LastName), q) ||
			strings.Contains(strings.ToLower(u.HouseNo), q) ||
			strings.Contains(strings.ToLower(u.Username), q) {
			out = append(out, u)
		}
	}
	return out, nil
}

func (s *Store) CreateHomeowner(_ context.Context, orgID int64, cmd application.CreateHomeownerCommand) (application.HomeownerUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id := s.nextUserID
	s.nextUserID++

	zoneID := cmd.ZoneID
	if zoneID <= 0 {
		zoneID = 1
	}
	zoneName := "หมู่ที่ 1 บ้านห้องแซงเหนือ"
	subzoneID := cmd.SubzoneID
	if subzoneID <= 0 {
		subzoneID = 1
	}
	subzoneName := "สายจดที่ 1 (คุ้มวัดเหนือ)"
	for _, z := range s.zones {
		if z.ID == zoneID {
			zoneName = z.ZoneName
			if len(z.Subzones) > 0 {
				subzoneID = z.Subzones[0].ID
				subzoneName = z.Subzones[0].SubzoneName
			}
		}
	}
	tambonCode := cmd.TambonCode
	if tambonCode <= 0 {
		tambonCode = 350805
	}
	username := strings.TrimSpace(cmd.Username)
	if username == "" {
		username = "home_" + strings.ReplaceAll(strings.TrimSpace(cmd.HouseNo), "/", "_")
	}
	prefix := strings.TrimSpace(cmd.Prefix)
	if prefix == "" {
		prefix = "คุณ"
	}
	addr := strings.TrimSpace(cmd.Address)
	if addr == "" {
		addr = strings.TrimSpace(cmd.HouseNo) + " " + zoneName + " ต.ห้องแซง"
	}
	u := application.HomeownerUser{
		ID:           id,
		OrgID:        orgID,
		Username:     username,
		Prefix:       prefix,
		FirstName:    strings.TrimSpace(cmd.FirstName),
		LastName:     strings.TrimSpace(cmd.LastName),
		HouseNo:      strings.TrimSpace(cmd.HouseNo),
		Address:      addr,
		ZoneID:       zoneID,
		ZoneName:     zoneName,
		SubzoneID:    subzoneID,
		SubzoneName:  subzoneName,
		TambonCode:   tambonCode,
		TambonName:   "ห้องแซง",
		DistrictCode: 3508,
		ProvinceCode: 35,
		Phone:        strings.TrimSpace(cmd.Phone),
		LineUserID:   strings.TrimSpace(cmd.LineUserID),
		ImageURL:     strings.TrimSpace(cmd.ImageURL),
		AvatarURL:    application.ResolveAvatarURL(cmd.ImageURL, cmd.FirstName, cmd.LastName),
		Status:       "active",
	}
	s.homeowners = append(s.homeowners, u)
	return u, nil
}

func (s *Store) UpdateHomeownerAvatar(_ context.Context, _ *int64, userID int64, avatarURL string) (application.HomeownerUser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.homeowners {
		if s.homeowners[i].ID == userID {
			s.homeowners[i].ImageURL = strings.TrimSpace(avatarURL)
			s.homeowners[i].AvatarURL = application.ResolveAvatarURL(avatarURL, s.homeowners[i].FirstName, s.homeowners[i].LastName)
			return s.homeowners[i], nil
		}
	}
	return application.HomeownerUser{}, application.ErrNotFound
}

func (s *Store) GetActiveRateConfig(_ context.Context, _ *int64) (application.MeterRateConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rateConfig, nil
}

func (s *Store) SaveRateConfig(_ context.Context, _ int64, cmd application.SaveRateConfigCommand) (application.MeterRateConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if strings.TrimSpace(cmd.MeterTypeName) != "" {
		s.rateConfig.MeterTypeName = strings.TrimSpace(cmd.MeterTypeName)
	}
	s.rateConfig.ReserveFee = cmd.ReserveFee
	s.rateConfig.VatPercent = cmd.VatPercent
	tiers := make([]application.RateTier, len(cmd.Tiers))
	copy(tiers, cmd.Tiers)
	s.rateConfig.Tiers = tiers
	return s.rateConfig, nil
}

func (s *Store) UpdateRateConfig(_ context.Context, orgID *int64, configID int64, cmd application.UpdateRateConfigCommand) (application.MeterRateConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.rateConfig.ID != configID {
		return application.MeterRateConfig{}, application.ErrNotFound
	}
	if orgID != nil && s.rateConfig.OrgID != *orgID {
		return application.MeterRateConfig{}, application.ErrForbidden
	}
	if cmd.PeriodID != nil {
		for _, p := range s.periods {
			if p.ID == *cmd.PeriodID && (orgID == nil || p.OrgID == *orgID) {
				status := strings.ToLower(strings.TrimSpace(p.Status))
				if status == "closed" || status == "finalized" {
					return application.MeterRateConfig{}, fmt.Errorf("%w: cannot edit rate config for a finalized period", application.ErrConflict)
				}
				break
			}
		}
	}
	if strings.TrimSpace(cmd.MeterTypeName) != "" {
		s.rateConfig.MeterTypeName = strings.TrimSpace(cmd.MeterTypeName)
	}
	s.rateConfig.ReserveFee = cmd.ReserveFee
	s.rateConfig.VatPercent = cmd.VatPercent
	s.org.VatRate = cmd.VatPercent
	tiers := make([]application.RateTier, len(cmd.Tiers))
	copy(tiers, cmd.Tiers)
	s.rateConfig.Tiers = tiers
	return s.rateConfig, nil
}

func (s *Store) ListPeriods(_ context.Context, _ *int64) ([]application.InvoicePeriod, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]application.InvoicePeriod, len(s.periods))
	copy(out, s.periods)
	return out, nil
}

func (s *Store) CreatePeriod(_ context.Context, orgID int64, cmd application.CreateInvoicePeriodCommand) (application.InvoicePeriod, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id := s.nextPeriod
	s.nextPeriod++
	start := strings.TrimSpace(cmd.StartDate)
	if start == "" {
		start = time.Now().Format("2006-01-02")
	}
	end := strings.TrimSpace(cmd.EndDate)
	if end == "" {
		end = time.Now().AddDate(0, 1, 0).Format("2006-01-02")
	}
	p := application.InvoicePeriod{
		ID:         id,
		OrgID:      orgID,
		PeriodName: strings.TrimSpace(cmd.PeriodName),
		StartDate:  start,
		EndDate:    end,
		Status:     "active",
	}
	s.periods = append([]application.InvoicePeriod{p}, s.periods...)
	return p, nil
}

func (s *Store) ListMeters(_ context.Context, _ *int64, zoneID *int64, query string) ([]application.WaterMeter, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	q := strings.ToLower(strings.TrimSpace(query))
	var out []application.WaterMeter
	for _, m := range s.meters {
		if zoneID != nil && *zoneID > 0 && m.UndertakeZoneID != *zoneID {
			continue
		}
		if q == "" ||
			strings.Contains(strings.ToLower(m.MeterNumber), q) ||
			strings.Contains(strings.ToLower(m.SubmeterName), q) ||
			strings.Contains(strings.ToLower(m.HouseNo), q) ||
			strings.Contains(strings.ToLower(m.MeterAddress), q) {
			out = append(out, m)
		}
	}
	return out, nil
}

func (s *Store) CreateMeter(_ context.Context, orgID int64, cmd application.CreateWaterMeterCommand) (application.WaterMeter, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id := s.nextMeterID
	s.nextMeterID++

	var owner application.HomeownerUser
	for _, u := range s.homeowners {
		if u.ID == cmd.UserID {
			owner = u
			break
		}
	}
	subName := strings.TrimSpace(cmd.SubmeterName)
	if subName == "" {
		subName = strings.TrimSpace(owner.Prefix + owner.FirstName + " " + owner.LastName)
	}
	addr := strings.TrimSpace(cmd.MeterAddress)
	if addr == "" {
		addr = owner.Address
	}
	zoneID := cmd.ZoneID
	if zoneID <= 0 {
		zoneID = owner.ZoneID
		if zoneID <= 0 {
			zoneID = 1
		}
	}
	subID := cmd.SubzoneID
	if subID <= 0 {
		subID = owner.SubzoneID
		if subID <= 0 {
			subID = 1
		}
	}
	zoneName := owner.ZoneName
	if zoneName == "" {
		zoneName = "หมู่ที่ 1 บ้านห้องแซงเหนือ"
	}
	subzoneName := owner.SubzoneName
	if subzoneName == "" {
		subzoneName = "สายจดที่ 1 (คุ้มวัดเหนือ)"
	}

	m := application.WaterMeter{
		MeterID:            id,
		OrgID:              orgID,
		UserID:             cmd.UserID,
		HomeownerName:      subName,
		HomeownerAvatarURL: application.ResolveAvatarURL(owner.ImageURL, owner.FirstName, owner.LastName),
		HouseNo:            owner.HouseNo,
		MeterNumber:        strings.TrimSpace(cmd.MeterNumber),
		FactoryNo:          strings.TrimSpace(cmd.FactoryNo),
		SubmeterName:       subName,
		MeterAddress:       addr,
		UndertakeZoneID:    zoneID,
		ZoneName:           zoneName,
		UndertakeSubzoneID: subID,
		SubzoneName:        subzoneName,
		MeterTypeID:        1,
		MeterTypeName:      s.rateConfig.MeterTypeName,
		Status:             "active",
		OweCount:           0,
		CutMeter:           "0",
		LastMeterRecording: cmd.InitialReading,
	}
	s.meters = append(s.meters, m)
	return m, nil
}

func (s *Store) RecordMeterReading(_ context.Context, orgID int64, _ int64, cmd application.RecordMeterReadingCommand) (application.WaterInvoice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	clientID := strings.TrimSpace(cmd.ClientReadingID)
	if clientID != "" {
		for _, existing := range s.invoices {
			if existing.ClientReadingID == clientID {
				return existing, nil
			}
		}
	}

	meterIdx := -1
	for i := range s.meters {
		if s.meters[i].MeterID == cmd.MeterID {
			meterIdx = i
			break
		}
	}
	if meterIdx < 0 {
		return application.WaterInvoice{}, application.ErrNotFound
	}
	meter := s.meters[meterIdx]
	if cmd.CurrentMeter < meter.LastMeterRecording {
		return application.WaterInvoice{}, application.ErrBadRequest
	}

	unitsUsed := math.Max(0, cmd.CurrentMeter-meter.LastMeterRecording)
	reserveFee := cmd.ReserveFee
	if reserveFee <= 0 {
		reserveFee = s.rateConfig.ReserveFee
	}
	vatPct := cmd.VatPercent
	if vatPct <= 0 {
		vatPct = s.rateConfig.VatPercent
	}
	bill := application.CalculateProgressiveWaterBill(unitsUsed, s.rateConfig.Tiers, reserveFee, vatPct)

	periodName := "11/2569"
	for _, p := range s.periods {
		if p.ID == cmd.PeriodID {
			periodName = p.PeriodName
			break
		}
	}

	recordedAt := strings.TrimSpace(cmd.RecordedAt)
	if recordedAt == "" {
		recordedAt = time.Now().UTC().Format(time.RFC3339)
	}

	invID := s.nextInvID
	s.nextInvID++
	inv := application.WaterInvoice{
		ID:              invID,
		InvoiceNo:       strings.TrimSpace(cmd.InvoiceNo),
		ClientReadingID: clientID,
		OrgID:           orgID,
		OrgName:         s.org.Name,
		MeterID:         meter.MeterID,
		MeterNumber:     meter.MeterNumber,
		HomeownerName:   meter.SubmeterName,
		HouseNo:         meter.HouseNo,
		ZoneName:        meter.ZoneName,
		PeriodID:        cmd.PeriodID,
		PeriodName:      periodName,
		LastMeter:       meter.LastMeterRecording,
		CurrentMeter:    cmd.CurrentMeter,
		WaterUsed:       bill.UnitsUsed,
		Paid:            bill.WaterCharge,
		ReserveMeter:    bill.ReserveFee,
		Vat:             bill.VatAmount,
		TotalPaid:       bill.TotalPayable,
		ReadingPhotoURL: strings.TrimSpace(cmd.ReadingPhotoURL),
		OCRText:         strings.TrimSpace(cmd.OCRText),
		OCRConfidence:   cmd.OCRConfidence,
		Status:          "invoice",
		RecordedAt:      recordedAt,
	}
	s.invoices = append([]application.WaterInvoice{inv}, s.invoices...)
	s.meters[meterIdx].LastMeterRecording = cmd.CurrentMeter
	s.meters[meterIdx].OweCount++
	return inv, nil
}

func (s *Store) ListReadings(_ context.Context, orgID *int64, filter application.MeterReadingFilter) ([]application.MeterReadingItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var targetPeriodID int64
	var targetPeriodName string
	if filter.PeriodID != nil && *filter.PeriodID > 0 {
		targetPeriodID = *filter.PeriodID
		for _, p := range s.periods {
			if p.ID == targetPeriodID {
				targetPeriodName = p.PeriodName
				break
			}
		}
	} else {
		for _, p := range s.periods {
			if orgID != nil && p.OrgID != *orgID {
				continue
			}
			if strings.EqualFold(p.Status, "active") {
				targetPeriodID = p.ID
				targetPeriodName = p.PeriodName
				break
			}
		}
	}

	meterByID := make(map[int64]application.WaterMeter, len(s.meters))
	for _, m := range s.meters {
		if orgID != nil && m.OrgID != *orgID {
			continue
		}
		if filter.RouteID != nil && *filter.RouteID > 0 {
			if m.RouteID == nil || *m.RouteID != *filter.RouteID {
				continue
			}
		}
		meterByID[m.MeterID] = m
	}

	recordedMeterIDs := make(map[int64]bool)
	recordedItems := make([]application.MeterReadingItem, 0)
	for _, inv := range s.invoices {
		if orgID != nil && inv.OrgID != *orgID {
			continue
		}
		if targetPeriodID > 0 && inv.PeriodID != targetPeriodID {
			continue
		}
		m, ok := meterByID[inv.MeterID]
		if !ok {
			continue
		}
		recordedMeterIDs[inv.MeterID] = true
		cur := inv.CurrentMeter
		recordedItems = append(recordedItems, application.MeterReadingItem{
			ID:            inv.ID,
			InvoiceNo:     inv.InvoiceNo,
			OrgID:         inv.OrgID,
			MeterID:       inv.MeterID,
			MeterNumber:   inv.MeterNumber,
			HomeownerName: inv.HomeownerName,
			HouseNo:       inv.HouseNo,
			ZoneName:      inv.ZoneName,
			RouteID:       m.RouteID,
			PeriodID:      inv.PeriodID,
			PeriodName:    inv.PeriodName,
			LastMeter:     inv.LastMeter,
			CurrentMeter:  &cur,
			WaterUsed:     inv.WaterUsed,
			TotalPaid:     inv.TotalPaid,
			ReadingStatus: "recorded",
			InvoiceStatus: inv.Status,
			RecordedAt:    inv.RecordedAt,
		})
	}

	if filter.Status == "recorded" {
		return recordedItems, nil
	}

	pendingItems := make([]application.MeterReadingItem, 0)
	for _, m := range s.meters {
		if _, ok := meterByID[m.MeterID]; !ok {
			continue
		}
		if recordedMeterIDs[m.MeterID] {
			continue
		}
		pendingItems = append(pendingItems, application.MeterReadingItem{
			OrgID:         m.OrgID,
			MeterID:       m.MeterID,
			MeterNumber:   m.MeterNumber,
			HomeownerName: m.HomeownerName,
			HouseNo:       m.HouseNo,
			ZoneName:      m.ZoneName,
			RouteID:       m.RouteID,
			PeriodID:      targetPeriodID,
			PeriodName:    targetPeriodName,
			LastMeter:     m.LastMeterRecording,
			ReadingStatus: "pending",
		})
	}

	if filter.Status == "pending" {
		return pendingItems, nil
	}

	return append(recordedItems, pendingItems...), nil
}

func (s *Store) ListInvoices(_ context.Context, _ *int64, status string, periodID *int64) ([]application.WaterInvoice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st := strings.ToLower(strings.TrimSpace(status))
	var out []application.WaterInvoice
	for _, inv := range s.invoices {
		if st != "" && strings.ToLower(inv.Status) != st {
			continue
		}
		if periodID != nil && *periodID > 0 && inv.PeriodID != *periodID {
			continue
		}
		out = append(out, inv)
	}
	return out, nil
}

func (s *Store) PayInvoice(_ context.Context, _ *int64, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.invoices {
		if s.invoices[i].ID == cmd.InvoiceID {
			s.invoices[i].Status = "paid"
			method := strings.TrimSpace(cmd.PaymentMethod)
			if method == "" {
				method = "cash"
			}
			s.invoices[i].PaymentMethod = method
			s.invoices[i].CashierID = cmd.CashierID
			s.invoices[i].PaidAt = time.Now().Format(time.RFC3339)
			s.invoices[i].ReceiptNo = fmt.Sprintf("RC-%s-%04d", time.Now().Format("200601"), s.invoices[i].ID)
			for mIdx := range s.meters {
				if s.meters[mIdx].MeterID == s.invoices[i].MeterID && s.meters[mIdx].OweCount > 0 {
					s.meters[mIdx].OweCount--
				}
			}
			return s.invoices[i], nil
		}
	}
	return application.WaterInvoice{}, application.ErrNotFound
}

func (s *Store) FindUnpaidInvoices(_ context.Context, orgID *int64, userID int64) ([]application.WaterInvoice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userMeters := make(map[int64]bool)
	for _, m := range s.meters {
		if m.UserID != userID {
			continue
		}
		if orgID != nil && m.OrgID != *orgID {
			continue
		}
		userMeters[m.MeterID] = true
	}

	out := make([]application.WaterInvoice, 0)
	for _, inv := range s.invoices {
		if orgID != nil && inv.OrgID != *orgID {
			continue
		}
		if !userMeters[inv.MeterID] {
			continue
		}
		st := strings.ToLower(strings.TrimSpace(inv.Status))
		if st != "invoice" && st != "owe" {
			continue
		}
		out = append(out, inv)
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].PeriodID != out[j].PeriodID {
			return out[i].PeriodID < out[j].PeriodID
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (s *Store) PayInvoicesBulk(_ context.Context, orgID *int64, cmd application.BulkPaymentCommand) (application.PaymentBatchResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	batchID := strings.ToLower(strings.TrimSpace(cmd.BatchID))
	if _, exists := s.paymentBatches[batchID]; exists {
		return application.PaymentBatchResult{}, fmt.Errorf("%w: duplicate batch_id", application.ErrConflict)
	}

	// Phase 1: Validate all invoices BEFORE mutating any state (atomic rollback guarantee)
	var resolvedOrgID int64
	if orgID != nil {
		resolvedOrgID = *orgID
	}

	targetIndices := make([]int, 0, len(cmd.InvoiceIDs))
	var serverTotal float64
	for _, invID := range cmd.InvoiceIDs {
		idx := -1
		for i := range s.invoices {
			if s.invoices[i].ID == invID {
				idx = i
				break
			}
		}
		if idx < 0 {
			return application.PaymentBatchResult{}, fmt.Errorf("%w: invoice %d not found", application.ErrNotFound, invID)
		}
		inv := s.invoices[idx]
		if resolvedOrgID == 0 {
			resolvedOrgID = inv.OrgID
		} else if inv.OrgID != resolvedOrgID {
			return application.PaymentBatchResult{}, fmt.Errorf("%w: invoice %d belongs to another organization", application.ErrForbidden, invID)
		}
		meterOwnedByUser := false
		for _, m := range s.meters {
			if m.MeterID == inv.MeterID && m.OrgID == resolvedOrgID && m.UserID == cmd.UserID {
				meterOwnedByUser = true
				break
			}
		}
		if !meterOwnedByUser {
			return application.PaymentBatchResult{}, fmt.Errorf("%w: invoice %d does not belong to user %d", application.ErrForbidden, invID, cmd.UserID)
		}
		st := strings.ToLower(strings.TrimSpace(inv.Status))
		if st != "invoice" && st != "owe" {
			return application.PaymentBatchResult{}, fmt.Errorf("%w: invoice %d is already paid or not payable", application.ErrConflict, invID)
		}
		serverTotal += inv.TotalPaid
		targetIndices = append(targetIndices, idx)
	}

	serverTotal = math.Round(serverTotal*100) / 100
	if cmd.Amount+0.01 < serverTotal {
		return application.PaymentBatchResult{}, fmt.Errorf("%w: payment amount %.2f is less than total due %.2f", application.ErrBadRequest, cmd.Amount, serverTotal)
	}

	// Phase 2: All checks passed — apply atomic mutation
	method := strings.TrimSpace(cmd.PaymentMethod)
	if method == "" {
		method = "cash"
	}
	cashierID := cmd.CashierID
	if cashierID <= 0 {
		cashierID = 1
	}
	now := time.Now().UTC()
	paidAt := now.Format(time.RFC3339)
	receiptNo := fmt.Sprintf("RC-BATCH-%s-%s", now.Format("200601"), strings.ToUpper(batchID[:8]))

	paidInvoices := make([]application.WaterInvoice, 0, len(targetIndices))
	for _, idx := range targetIndices {
		s.invoices[idx].Status = "paid"
		s.invoices[idx].PaymentMethod = method
		s.invoices[idx].CashierID = cashierID
		s.invoices[idx].PaidAt = paidAt
		s.invoices[idx].ReceiptNo = receiptNo
		for mIdx := range s.meters {
			if s.meters[mIdx].MeterID == s.invoices[idx].MeterID && s.meters[mIdx].OrgID == resolvedOrgID && s.meters[mIdx].OweCount > 0 {
				s.meters[mIdx].OweCount--
			}
		}
		paidInvoices = append(paidInvoices, s.invoices[idx])
	}

	result := application.PaymentBatchResult{
		BatchID:       batchID,
		OrgID:         resolvedOrgID,
		UserID:        cmd.UserID,
		TotalAmount:   serverTotal,
		PaymentMethod: method,
		ReceiptNo:     receiptNo,
		PaidAt:        paidAt,
		ReceivedBy:    cashierID,
		Invoices:      paidInvoices,
	}
	s.paymentBatches[batchID] = result
	return result, nil
}

func (s *Store) SeedCrossOrgMeterAndInvoice(meter application.WaterMeter, inv application.WaterInvoice) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.meters = append(s.meters, meter)
	s.invoices = append(s.invoices, inv)
}

func (s *Store) SeedCrossOrgHomeowner(u application.HomeownerUser) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.homeowners = append(s.homeowners, u)
}

func (s *Store) InsertDebtNotice(_ context.Context, orgID *int64, cmd application.CreateDebtNoticeCommand) (application.DebtNotice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var resolvedOrgID int64
	if orgID != nil {
		resolvedOrgID = *orgID
	}

	var totalOverdue float64
	var homeownerName, houseNo, meterNumber string

	for _, invID := range cmd.InvoiceIDs {
		idx := -1
		for i := range s.invoices {
			if s.invoices[i].ID == invID {
				idx = i
				break
			}
		}
		if idx < 0 {
			return application.DebtNotice{}, fmt.Errorf("%w: invoice %d not found", application.ErrNotFound, invID)
		}
		inv := s.invoices[idx]
		if resolvedOrgID == 0 {
			resolvedOrgID = inv.OrgID
		} else if inv.OrgID != resolvedOrgID {
			return application.DebtNotice{}, fmt.Errorf("%w: invoice %d belongs to another organization", application.ErrForbidden, invID)
		}
		var ownedMeter *application.WaterMeter
		for mIdx := range s.meters {
			if s.meters[mIdx].MeterID == inv.MeterID && s.meters[mIdx].OrgID == resolvedOrgID && s.meters[mIdx].UserID == cmd.UserID {
				ownedMeter = &s.meters[mIdx]
				break
			}
		}
		if ownedMeter == nil {
			return application.DebtNotice{}, fmt.Errorf("%w: invoice %d does not belong to user %d", application.ErrForbidden, invID, cmd.UserID)
		}
		st := strings.ToLower(strings.TrimSpace(inv.Status))
		if st != "invoice" && st != "owe" {
			return application.DebtNotice{}, fmt.Errorf("%w: invoice %d is already paid", application.ErrConflict, invID)
		}
		totalOverdue += inv.TotalPaid
		if homeownerName == "" {
			homeownerName = ownedMeter.HomeownerName
			houseNo = ownedMeter.HouseNo
			meterNumber = ownedMeter.MeterNumber
		}
	}

	seq := s.nextDebtSeq
	s.nextDebtSeq++
	id := fmt.Sprintf("00000000-0000-4000-8000-%012d", seq)
	now := time.Now().UTC().Format(time.RFC3339)

	invIDs := make([]int64, len(cmd.InvoiceIDs))
	copy(invIDs, cmd.InvoiceIDs)

	notice := application.DebtNotice{
		ID:                 id,
		OrgID:              resolvedOrgID,
		UserID:             cmd.UserID,
		HomeownerName:      homeownerName,
		HouseNo:            houseNo,
		MeterNumber:        meterNumber,
		InvoiceIDs:         invIDs,
		TotalOverdueAmount: math.Round(totalOverdue*100) / 100,
		Status:             application.DebtNoticeStatusSent,
		NoticeSentAt:       now,
		CreatedAt:          now,
	}
	s.debtNotices = append([]application.DebtNotice{notice}, s.debtNotices...)
	return notice, nil
}

func (s *Store) FindDebtNotices(_ context.Context, orgID *int64, filter application.DebtNoticeFilter) ([]application.DebtNotice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	st := strings.ToLower(strings.TrimSpace(filter.Status))
	out := make([]application.DebtNotice, 0)
	for _, n := range s.debtNotices {
		if orgID != nil && n.OrgID != *orgID {
			continue
		}
		if st != "" && strings.ToLower(n.Status) != st {
			continue
		}
		if filter.UserID != nil && n.UserID != *filter.UserID {
			continue
		}
		out = append(out, n)
	}
	return out, nil
}

func (s *Store) FindDebtNoticeByID(_ context.Context, orgID *int64, id string) (application.DebtNotice, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	target := strings.ToLower(strings.TrimSpace(id))
	for _, n := range s.debtNotices {
		if strings.ToLower(n.ID) != target {
			continue
		}
		if orgID != nil && n.OrgID != *orgID {
			return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
		}
		return n, nil
	}
	return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
}

func (s *Store) CutMeterByDebtNotice(_ context.Context, orgID *int64, id string, cmd application.CutMeterCommand) (application.DebtNotice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target := strings.ToLower(strings.TrimSpace(id))
	idx := -1
	for i := range s.debtNotices {
		if strings.ToLower(s.debtNotices[i].ID) == target {
			if orgID != nil && s.debtNotices[i].OrgID != *orgID {
				return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
			}
			idx = i
			break
		}
	}
	if idx < 0 {
		return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
	}
	if s.debtNotices[idx].Status != application.DebtNoticeStatusSent && s.debtNotices[idx].Status != application.DebtNoticeStatusPending {
		return application.DebtNotice{}, fmt.Errorf("%w: debt notice status %q cannot be cut", application.ErrConflict, s.debtNotices[idx].Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	reading := cmd.MeterReading
	cutBy := cmd.CutBy
	noticeID := s.debtNotices[idx].ID
	noticeOrgID := s.debtNotices[idx].OrgID
	noticeUserID := s.debtNotices[idx].UserID

	s.debtNotices[idx].Status = application.DebtNoticeStatusCut
	s.debtNotices[idx].CutAt = now
	s.debtNotices[idx].CutBy = &cutBy
	s.debtNotices[idx].CutMeterReading = &reading

	for mIdx := range s.meters {
		if s.meters[mIdx].OrgID == noticeOrgID && s.meters[mIdx].UserID == noticeUserID {
			s.meters[mIdx].Status = "disconnected"
			s.meters[mIdx].CutMeter = "1"
			nid := noticeID
			s.meters[mIdx].DebtNoticeID = &nid
		}
	}

	return s.debtNotices[idx], nil
}

func (s *Store) RestoreMeterByDebtNotice(_ context.Context, orgID *int64, id string, restoredBy int64) (application.DebtNotice, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target := strings.ToLower(strings.TrimSpace(id))
	idx := -1
	for i := range s.debtNotices {
		if strings.ToLower(s.debtNotices[i].ID) == target {
			if orgID != nil && s.debtNotices[i].OrgID != *orgID {
				return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
			}
			idx = i
			break
		}
	}
	if idx < 0 {
		return application.DebtNotice{}, fmt.Errorf("%w: debt notice not found", application.ErrNotFound)
	}
	if s.debtNotices[idx].Status != application.DebtNoticeStatusCut {
		return application.DebtNotice{}, fmt.Errorf("%w: debt notice status %q cannot be restored", application.ErrConflict, s.debtNotices[idx].Status)
	}

	noticeOrgID := s.debtNotices[idx].OrgID
	noticeUserID := s.debtNotices[idx].UserID

	// Re-check unpaid invoices under write lock to prevent TOCTOU race
	userMeters := make(map[int64]bool)
	for _, m := range s.meters {
		if m.OrgID == noticeOrgID && m.UserID == noticeUserID {
			userMeters[m.MeterID] = true
		}
	}
	for _, inv := range s.invoices {
		if inv.OrgID == noticeOrgID && userMeters[inv.MeterID] {
			st := strings.ToLower(strings.TrimSpace(inv.Status))
			if st == "invoice" || st == "owe" {
				return application.DebtNotice{}, fmt.Errorf("%w: outstanding balance remaining", application.ErrBadRequest)
			}
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	rb := restoredBy
	s.debtNotices[idx].Status = application.DebtNoticeStatusRestored
	s.debtNotices[idx].RestoredAt = now
	s.debtNotices[idx].RestoredBy = &rb

	for mIdx := range s.meters {
		if s.meters[mIdx].OrgID == noticeOrgID && s.meters[mIdx].UserID == noticeUserID {
			s.meters[mIdx].Status = "active"
			s.meters[mIdx].CutMeter = "0"
		}
	}

	return s.debtNotices[idx], nil
}

func (s *Store) InsertIncident(_ context.Context, orgID int64, reporterUserID int64, cmd application.CreateIncidentCommand) (application.Incident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	seq := s.nextIncidentSeq
	s.nextIncidentSeq++
	id := fmt.Sprintf("10000000-0000-4000-8000-%012d", seq)
	now := time.Now().UTC().Format(time.RFC3339)

	var reporterName string
	for _, h := range s.homeowners {
		if h.ID == reporterUserID && h.OrgID == orgID {
			reporterName = strings.TrimSpace(h.FirstName + " " + h.LastName)
			break
		}
	}

	var latCopy, lngCopy *float64
	if cmd.Lat != nil {
		v := *cmd.Lat
		latCopy = &v
	}
	if cmd.Lng != nil {
		v := *cmd.Lng
		lngCopy = &v
	}

	inc := application.Incident{
		ID:             id,
		OrgID:          orgID,
		ReporterUserID: reporterUserID,
		ReporterName:   reporterName,
		IncidentType:   strings.ToLower(strings.TrimSpace(cmd.IncidentType)),
		Description:    strings.TrimSpace(cmd.Description),
		Lat:            latCopy,
		Lng:            lngCopy,
		PhotoURL:       strings.TrimSpace(cmd.PhotoURL),
		Status:         application.IncidentStatusOpen,
		CreatedAt:      now,
	}
	s.incidents = append([]application.Incident{inc}, s.incidents...)
	return inc, nil
}

func (s *Store) FindIncidents(_ context.Context, orgID *int64, filter application.IncidentFilter) ([]application.Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	st := strings.ToLower(strings.TrimSpace(filter.Status))
	out := make([]application.Incident, 0)
	for _, inc := range s.incidents {
		if orgID != nil && inc.OrgID != *orgID {
			continue
		}
		if st != "" && strings.ToLower(inc.Status) != st {
			continue
		}
		if filter.AssignedTo != nil {
			if inc.AssignedTo == nil || *inc.AssignedTo != *filter.AssignedTo {
				continue
			}
		}
		// List view must omit lat/lng
		item := inc
		item.Lat = nil
		item.Lng = nil
		out = append(out, item)
	}
	return out, nil
}

func (s *Store) FindMyIncidents(_ context.Context, orgID *int64, reporterUserID int64) ([]application.Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]application.Incident, 0)
	for _, inc := range s.incidents {
		if orgID != nil && inc.OrgID != *orgID {
			continue
		}
		if inc.ReporterUserID != reporterUserID {
			continue
		}
		// List view must omit lat/lng
		item := inc
		item.Lat = nil
		item.Lng = nil
		out = append(out, item)
	}
	return out, nil
}

func (s *Store) FindIncidentByID(_ context.Context, orgID *int64, id string) (application.Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	target := strings.ToLower(strings.TrimSpace(id))
	for _, inc := range s.incidents {
		if strings.ToLower(inc.ID) != target {
			continue
		}
		if orgID != nil && inc.OrgID != *orgID {
			return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
		}
		return inc, nil
	}
	return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
}

func (s *Store) AssignIncident(_ context.Context, orgID *int64, id string, staffID int64) (application.Incident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target := strings.ToLower(strings.TrimSpace(id))
	idx := -1
	for i := range s.incidents {
		if strings.ToLower(s.incidents[i].ID) == target {
			if orgID != nil && s.incidents[i].OrgID != *orgID {
				return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
			}
			idx = i
			break
		}
	}
	if idx < 0 {
		return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
	}

	cur := &s.incidents[idx]
	if cur.Status != application.IncidentStatusOpen && cur.Status != application.IncidentStatusInProgress {
		return application.Incident{}, fmt.Errorf("%w: incident status %q cannot be assigned", application.ErrBadRequest, cur.Status)
	}

	staffExists := false
	for _, u := range s.homeowners {
		if u.ID == staffID && u.OrgID == cur.OrgID {
			staffExists = true
			break
		}
	}
	if !staffExists {
		return application.Incident{}, fmt.Errorf("%w: staff_id not found in organization", application.ErrBadRequest)
	}

	if cur.AssignedTo != nil && *cur.AssignedTo != staffID {
		note := fmt.Sprintf("[reassigned from staff #%d]", *cur.AssignedTo)
		if strings.TrimSpace(cur.Description) == "" {
			cur.Description = note
		} else {
			cur.Description = cur.Description + "\n" + note
		}
	}

	sid := staffID
	cur.Status = application.IncidentStatusInProgress
	cur.AssignedTo = &sid
	cur.AssignedAt = time.Now().UTC().Format(time.RFC3339)
	return *cur, nil
}

func (s *Store) ResolveIncident(_ context.Context, orgID *int64, id string, resolutionNote string) (application.Incident, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	target := strings.ToLower(strings.TrimSpace(id))
	idx := -1
	for i := range s.incidents {
		if strings.ToLower(s.incidents[i].ID) == target {
			if orgID != nil && s.incidents[i].OrgID != *orgID {
				return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
			}
			idx = i
			break
		}
	}
	if idx < 0 {
		return application.Incident{}, fmt.Errorf("%w: incident not found", application.ErrNotFound)
	}

	cur := &s.incidents[idx]
	if cur.Status != application.IncidentStatusInProgress {
		return application.Incident{}, fmt.Errorf("%w: incident status %q must be in_progress to resolve", application.ErrBadRequest, cur.Status)
	}

	cur.Status = application.IncidentStatusResolved
	cur.ResolvedAt = time.Now().UTC().Format(time.RFC3339)
	cur.ResolutionNote = strings.TrimSpace(resolutionNote)
	return *cur, nil
}

func (s *Store) GetLiffPortalData(_ context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.findLiffPortalLocked(lineUserID, meterNumber, houseNo)
}

func (s *Store) LinkLiffAccount(_ context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var targetUserID int64
	for _, m := range s.meters {
		if strings.EqualFold(m.MeterNumber, strings.TrimSpace(cmd.MeterNumber)) {
			targetUserID = m.UserID
			break
		}
	}
	if targetUserID == 0 {
		return application.LiffResidentPortalData{}, application.ErrNotFound
	}
	for i := range s.homeowners {
		if s.homeowners[i].ID == targetUserID {
			s.homeowners[i].LineUserID = strings.TrimSpace(cmd.LineUserID)
			break
		}
	}
	return s.findLiffPortalLocked(cmd.LineUserID, cmd.MeterNumber, cmd.HouseNo)
}

func (s *Store) findLiffPortalLocked(lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error) {
	var owner *application.HomeownerUser
	trimmedLine := strings.TrimSpace(lineUserID)
	trimmedMeter := strings.TrimSpace(meterNumber)
	trimmedHouse := strings.TrimSpace(houseNo)

	if trimmedLine != "" {
		for i := range s.homeowners {
			if strings.EqualFold(s.homeowners[i].LineUserID, trimmedLine) {
				u := s.homeowners[i]
				owner = &u
				break
			}
		}
	}
	if owner == nil && trimmedMeter != "" {
		for _, m := range s.meters {
			if strings.EqualFold(m.MeterNumber, trimmedMeter) {
				for i := range s.homeowners {
					if s.homeowners[i].ID == m.UserID {
						u := s.homeowners[i]
						owner = &u
						break
					}
				}
			}
		}
	}
	if owner == nil && trimmedHouse != "" {
		for i := range s.homeowners {
			if strings.EqualFold(s.homeowners[i].HouseNo, trimmedHouse) {
				u := s.homeowners[i]
				owner = &u
				break
			}
		}
	}
	if owner == nil && len(s.homeowners) > 0 {
		u := s.homeowners[0]
		owner = &u
	}
	if owner == nil {
		return application.LiffResidentPortalData{}, application.ErrNotFound
	}
	owner.AvatarURL = application.ResolveAvatarURL(owner.ImageURL, owner.FirstName, owner.LastName)

	var meters []application.WaterMeter
	meterIDs := map[int64]bool{}
	for _, m := range s.meters {
		if m.UserID == owner.ID {
			meters = append(meters, m)
			meterIDs[m.MeterID] = true
		}
	}
	var invoices []application.WaterInvoice
	var unpaidTotal float64
	for _, inv := range s.invoices {
		if meterIDs[inv.MeterID] {
			invoices = append(invoices, inv)
			if inv.Status != "paid" {
				unpaidTotal += inv.TotalPaid
			}
		}
	}
	return application.LiffResidentPortalData{
		Homeowner:   *owner,
		Meters:      meters,
		Invoices:    invoices,
		UnpaidTotal: math.Round(unpaidTotal*100) / 100,
	}, nil
}
