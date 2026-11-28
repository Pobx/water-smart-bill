package sqldb

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pobx/water-smart-bill/backend-go/application"
)

type Store struct {
	db *pgxpool.Pool
}

func NewStore(ctx context.Context, databaseURL string, migrationsDir string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	s := &Store{db: pool}
	if migrationsDir != "" {
		if err := s.runMigrations(ctx, migrationsDir); err != nil {
			pool.Close()
			return nil, fmt.Errorf("run migrations: %w", err)
		}
	}
	return s, nil
}

func (s *Store) Close() {
	if s.db != nil {
		s.db.Close()
	}
}

func (s *Store) GetOrganization(ctx context.Context, orgID *int64) (application.Organization, error) {
	const q = `
SELECT o.id, o.org_code, o.org_name, COALESCE(o.org_address, ''),
       COALESCE(o.org_tambon_id_fk, 350805), COALESCE(t.tambon_name, 'ห้องแซง'),
       COALESCE(o.org_district_id_fk, 3508), COALESCE(d.district_name, 'เลิงนกทา'),
       COALESCE(o.org_province_id_fk, 35), COALESCE(p.province_name, 'ยโสธร'),
       COALESCE(o.org_zipcode, '35120'), COALESCE(o.org_phone, ''),
       COALESCE(o.org_dept_name, ''), COALESCE(o.org_head_name, ''),
       COALESCE(o.fin_head_name, ''), COALESCE(o.tw_head_name, ''),
       COALESCE(o.org_logo_img, ''), COALESCE(o.meternumbercode, 'HSG'),
       COALESCE(o.cutmeter_count, 3), COALESCE(o.vat, 7.0)::float8
FROM organizations o
LEFT JOIN tambons t ON t.id = o.org_tambon_id_fk
LEFT JOIN districts d ON d.id = o.org_district_id_fk
LEFT JOIN provinces p ON p.id = o.org_province_id_fk
WHERE ($1::bigint IS NULL OR o.id = $1)
ORDER BY o.id
LIMIT 1
`
	var org application.Organization
	err := s.db.QueryRow(ctx, q, orgID).Scan(
		&org.ID, &org.Code, &org.Name, &org.Address,
		&org.TambonID, &org.TambonName,
		&org.DistrictID, &org.DistrictName,
		&org.ProvinceID, &org.ProvinceName,
		&org.Zipcode, &org.Phone, &org.DeptName,
		&org.HeadName, &org.FinHeadName, &org.TwHeadName,
		&org.LogoImg, &org.MeterPrefix, &org.CutMeterThreshold, &org.VatRate,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return application.Organization{}, application.ErrNotFound
	}
	return org, err
}

func (s *Store) UpsertOrganization(ctx context.Context, orgID int64, cmd application.UpsertOrganizationCommand) (application.Organization, error) {
	const q = `
UPDATE organizations
SET org_code = $2,
    org_name = $3,
    org_address = $4,
    org_phone = $5,
    org_dept_name = $6,
    org_head_name = $7,
    fin_head_name = $8,
    tw_head_name = $9,
    meternumbercode = COALESCE(NULLIF($10, ''), meternumbercode),
    vat = CASE WHEN $11::numeric > 0 THEN $11::numeric ELSE vat END,
    updated_at = NOW()
WHERE id = $1
`
	_, err := s.db.Exec(ctx, q,
		orgID, strings.TrimSpace(cmd.Code), strings.TrimSpace(cmd.Name),
		strings.TrimSpace(cmd.Address), strings.TrimSpace(cmd.Phone),
		strings.TrimSpace(cmd.DeptName), strings.TrimSpace(cmd.HeadName),
		strings.TrimSpace(cmd.FinHeadName), strings.TrimSpace(cmd.TwHeadName),
		strings.TrimSpace(cmd.MeterPrefix), cmd.VatRate,
	)
	if err != nil {
		return application.Organization{}, err
	}
	return s.GetOrganization(ctx, &orgID)
}

func (s *Store) ListTambons(ctx context.Context) ([]application.TambonInfo, error) {
	const q = `
SELECT t.id, t.tambon_name, d.id, d.district_name, p.id, p.province_name, t.zipcode
FROM tambons t
JOIN districts d ON d.id = t.district_id
JOIN provinces p ON p.id = d.province_id
ORDER BY t.id
`
	rows, err := s.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.TambonInfo{}
	for rows.Next() {
		var ti application.TambonInfo
		if err := rows.Scan(&ti.TambonID, &ti.TambonName, &ti.DistrictID, &ti.DistrictName, &ti.ProvinceID, &ti.ProvinceName, &ti.Zipcode); err != nil {
			return nil, err
		}
		out = append(out, ti)
	}
	return out, rows.Err()
}

func (s *Store) FindMeterRoutes(ctx context.Context, orgID *int64) ([]application.MeterRoute, error) {
	const q = `
SELECT id, org_id, name, staff_id
FROM tw_meter_routes
WHERE ($1::bigint IS NULL OR org_id = $1)
ORDER BY name, id
`
	rows, err := s.db.Query(ctx, q, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]application.MeterRoute, 0)
	for rows.Next() {
		var r application.MeterRoute
		if err := rows.Scan(&r.ID, &r.OrgID, &r.Name, &r.StaffID); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListZones(ctx context.Context, orgID *int64) ([]application.Zone, error) {
	const qZones = `
SELECT z.id, z.org_id, z.tambon_id, COALESCE(t.tambon_name, 'ห้องแซง'), z.moo_no, z.zone_name, z.location, z.status
FROM zones z
LEFT JOIN tambons t ON t.id = z.tambon_id
WHERE ($1::bigint IS NULL OR z.org_id = $1)
ORDER BY z.moo_no, z.id
`
	rows, err := s.db.Query(ctx, qZones, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	zones := []application.Zone{}
	idxByID := map[int64]int{}
	for rows.Next() {
		var z application.Zone
		z.Subzones = []application.Subzone{}
		if err := rows.Scan(&z.ID, &z.OrgID, &z.TambonID, &z.TambonName, &z.MooNo, &z.ZoneName, &z.Location, &z.Status); err != nil {
			return nil, err
		}
		idxByID[z.ID] = len(zones)
		zones = append(zones, z)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	const qSub = `
SELECT id, org_id, zone_id, subzone_name, status
FROM subzones
WHERE ($1::bigint IS NULL OR org_id = $1)
ORDER BY id
`
	sRows, err := s.db.Query(ctx, qSub, orgID)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()
	for sRows.Next() {
		var sz application.Subzone
		if err := sRows.Scan(&sz.ID, &sz.OrgID, &sz.ZoneID, &sz.SubzoneName, &sz.Status); err != nil {
			return nil, err
		}
		if idx, ok := idxByID[sz.ZoneID]; ok {
			zones[idx].Subzones = append(zones[idx].Subzones, sz)
		}
	}
	return zones, sRows.Err()
}

func (s *Store) CreateZone(ctx context.Context, orgID int64, cmd application.CreateZoneCommand) (application.Zone, error) {
	tambonID := cmd.TambonID
	if tambonID <= 0 {
		tambonID = 350805
	}
	moo := cmd.MooNo
	if moo <= 0 {
		moo = 1
	}
	var z application.Zone
	const qIns = `
INSERT INTO zones (org_id, tambon_id, moo_no, zone_name, location, status)
VALUES ($1, $2, $3, $4, $5, 'active')
RETURNING id, org_id, tambon_id, 'ห้องแซง', moo_no, zone_name, location, status
`
	err := s.db.QueryRow(ctx, qIns, orgID, tambonID, moo, strings.TrimSpace(cmd.ZoneName), strings.TrimSpace(cmd.Location)).
		Scan(&z.ID, &z.OrgID, &z.TambonID, &z.TambonName, &z.MooNo, &z.ZoneName, &z.Location, &z.Status)
	if err != nil {
		return application.Zone{}, err
	}
	subName := strings.TrimSpace(cmd.SubzoneName)
	if subName == "" {
		subName = "สายจดหลัก (" + z.ZoneName + ")"
	}
	var sz application.Subzone
	const qSub = `
INSERT INTO subzones (org_id, zone_id, subzone_name, status)
VALUES ($1, $2, $3, 'active')
RETURNING id, org_id, zone_id, subzone_name, status
`
	if err := s.db.QueryRow(ctx, qSub, orgID, z.ID, subName).Scan(&sz.ID, &sz.OrgID, &sz.ZoneID, &sz.SubzoneName, &sz.Status); err == nil {
		z.Subzones = []application.Subzone{sz}
	}
	return z, nil
}

func (s *Store) ListHomeowners(ctx context.Context, orgID *int64, query string) ([]application.HomeownerUser, error) {
	const q = `
SELECT u.id, u.org_id, u.username, u.prefix, u.firstname, u.lastname, u.house_no, u.address,
       u.zone_id, COALESCE(z.zone_name, ''), u.subzone_id, COALESCE(sz.subzone_name, ''),
       u.tambon_code, COALESCE(t.tambon_name, 'ห้องแซง'), u.district_code, u.province_code,
       u.phone, u.line_user_id, u.image, u.status
FROM users u
LEFT JOIN zones z ON z.id = u.zone_id
LEFT JOIN subzones sz ON sz.id = u.subzone_id
LEFT JOIN tambons t ON t.id = u.tambon_code
WHERE ($1::bigint IS NULL OR u.org_id = $1)
  AND ($2::text = '' OR u.firstname ILIKE '%' || $2 || '%' OR u.lastname ILIKE '%' || $2 || '%' OR u.house_no ILIKE '%' || $2 || '%')
ORDER BY u.id
`
	rows, err := s.db.Query(ctx, q, orgID, strings.TrimSpace(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.HomeownerUser{}
	for rows.Next() {
		var u application.HomeownerUser
		if err := rows.Scan(
			&u.ID, &u.OrgID, &u.Username, &u.Prefix, &u.FirstName, &u.LastName, &u.HouseNo, &u.Address,
			&u.ZoneID, &u.ZoneName, &u.SubzoneID, &u.SubzoneName,
			&u.TambonCode, &u.TambonName, &u.DistrictCode, &u.ProvinceCode,
			&u.Phone, &u.LineUserID, &u.ImageURL, &u.Status,
		); err != nil {
			return nil, err
		}
		u.AvatarURL = application.ResolveAvatarURL(u.ImageURL, u.FirstName, u.LastName)
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) CreateHomeowner(ctx context.Context, orgID int64, cmd application.CreateHomeownerCommand) (application.HomeownerUser, error) {
	username := strings.TrimSpace(cmd.Username)
	if username == "" {
		username = fmt.Sprintf("user_%d", time.Now().UnixNano())
	}
	zoneID := cmd.ZoneID
	if zoneID <= 0 {
		zoneID = 1
	}
	subzoneID := cmd.SubzoneID
	if subzoneID <= 0 {
		subzoneID = 1
	}
	tambonCode := cmd.TambonCode
	if tambonCode <= 0 {
		tambonCode = 350805
	}
	const q = `
INSERT INTO users (org_id, username, prefix, firstname, lastname, house_no, address, zone_id, subzone_id, tambon_code, district_code, province_code, phone, line_user_id, image)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 3508, 35, $11, $12, $13)
RETURNING id
`
	var id int64
	err := s.db.QueryRow(ctx, q,
		orgID, username, strings.TrimSpace(cmd.Prefix), strings.TrimSpace(cmd.FirstName),
		strings.TrimSpace(cmd.LastName), strings.TrimSpace(cmd.HouseNo), strings.TrimSpace(cmd.Address),
		zoneID, subzoneID, tambonCode, strings.TrimSpace(cmd.Phone), strings.TrimSpace(cmd.LineUserID), strings.TrimSpace(cmd.ImageURL),
	).Scan(&id)
	if err != nil {
		return application.HomeownerUser{}, err
	}
	users, err := s.ListHomeowners(ctx, &orgID, "")
	if err != nil {
		return application.HomeownerUser{}, err
	}
	for _, u := range users {
		if u.ID == id {
			return u, nil
		}
	}
	return application.HomeownerUser{}, application.ErrNotFound
}

func (s *Store) UpdateHomeownerAvatar(ctx context.Context, orgID *int64, userID int64, avatarURL string) (application.HomeownerUser, error) {
	const q = `UPDATE users SET image = $3, updated_at = NOW() WHERE id = $2 AND ($1::bigint IS NULL OR org_id = $1)`
	_, err := s.db.Exec(ctx, q, orgID, userID, strings.TrimSpace(avatarURL))
	if err != nil {
		return application.HomeownerUser{}, err
	}
	users, err := s.ListHomeowners(ctx, orgID, "")
	if err != nil {
		return application.HomeownerUser{}, err
	}
	for _, u := range users {
		if u.ID == userID {
			return u, nil
		}
	}
	return application.HomeownerUser{}, application.ErrNotFound
}

func (s *Store) GetActiveRateConfig(ctx context.Context, orgID *int64) (application.MeterRateConfig, error) {
	const qCfg = `
SELECT rc.id, rc.org_id, rc.meter_type_id_fk, COALESCE(mt.meter_type_name, 'ประปาครัวเรือน'),
       COALESCE(pt.name, 'progressive'), COALESCE(mt.reserve_fee, 10)::float8, COALESCE(rc.vat, 7)::float8
FROM tw_meter_type_rate_configs rc
LEFT JOIN tw_meter_types mt ON mt.id = rc.meter_type_id_fk
LEFT JOIN tw_pricing_types pt ON pt.id = rc.pricing_type_id
WHERE ($1::bigint IS NULL OR rc.org_id = $1)
ORDER BY rc.id
LIMIT 1
`
	var rc application.MeterRateConfig
	err := s.db.QueryRow(ctx, qCfg, orgID).Scan(
		&rc.ID, &rc.OrgID, &rc.MeterTypeID, &rc.MeterTypeName, &rc.PricingType, &rc.ReserveFee, &rc.VatPercent,
	)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	const qTiers = `
SELECT tier_order, min_units, max_units, rate_per_unit::float8, COALESCE(comment, '')
FROM tw_meter_type_rate_tiers
WHERE meter_type_rate_config_id = $1
ORDER BY tier_order
`
	rows, err := s.db.Query(ctx, qTiers, rc.ID)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	defer rows.Close()
	rc.Tiers = []application.RateTier{}
	for rows.Next() {
		var t application.RateTier
		if err := rows.Scan(&t.TierOrder, &t.MinUnits, &t.MaxUnits, &t.RatePerUnit, &t.Comment); err != nil {
			return application.MeterRateConfig{}, err
		}
		rc.Tiers = append(rc.Tiers, t)
	}
	return rc, rows.Err()
}

func (s *Store) SaveRateConfig(ctx context.Context, orgID int64, cmd application.SaveRateConfigCommand) (application.MeterRateConfig, error) {
	rc, err := s.GetActiveRateConfig(ctx, &orgID)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	_, _ = s.db.Exec(ctx, `UPDATE tw_meter_types SET reserve_fee = $2, meter_type_name = COALESCE(NULLIF($3, ''), meter_type_name) WHERE id = $1`, rc.MeterTypeID, cmd.ReserveFee, strings.TrimSpace(cmd.MeterTypeName))
	_, _ = s.db.Exec(ctx, `UPDATE tw_meter_type_rate_configs SET vat = $2 WHERE id = $1`, rc.ID, cmd.VatPercent)
	_, _ = s.db.Exec(ctx, `DELETE FROM tw_meter_type_rate_tiers WHERE meter_type_rate_config_id = $1`, rc.ID)
	for _, t := range cmd.Tiers {
		_, err := s.db.Exec(ctx, `
INSERT INTO tw_meter_type_rate_tiers (meter_type_rate_config_id, tier_order, min_units, max_units, rate_per_unit, comment)
VALUES ($1, $2, $3, $4, $5, $6)
`, rc.ID, t.TierOrder, t.MinUnits, t.MaxUnits, t.RatePerUnit, t.Comment)
		if err != nil {
			return application.MeterRateConfig{}, err
		}
	}
	return s.GetActiveRateConfig(ctx, &orgID)
}

func (s *Store) UpdateRateConfig(ctx context.Context, orgID *int64, configID int64, cmd application.UpdateRateConfigCommand) (application.MeterRateConfig, error) {
	const qCheck = `
SELECT rc.id, rc.org_id, rc.meter_type_id_fk
FROM tw_meter_type_rate_configs rc
WHERE rc.id = $1 AND ($2::bigint IS NULL OR rc.org_id = $2)
`
	var foundID, foundOrgID, meterTypeID int64
	if err := s.db.QueryRow(ctx, qCheck, configID, orgID).Scan(&foundID, &foundOrgID, &meterTypeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return application.MeterRateConfig{}, application.ErrNotFound
		}
		return application.MeterRateConfig{}, err
	}

	if cmd.PeriodID != nil {
		var status string
		err := s.db.QueryRow(ctx, `SELECT status FROM invoice_period WHERE id = $1 AND org_id = $2`, *cmd.PeriodID, foundOrgID).Scan(&status)
		if err == nil {
			normalized := strings.ToLower(strings.TrimSpace(status))
			if normalized == "closed" || normalized == "finalized" {
				return application.MeterRateConfig{}, fmt.Errorf("%w: cannot edit rate config for a finalized period", application.ErrConflict)
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return application.MeterRateConfig{}, err
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return application.MeterRateConfig{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `UPDATE tw_meter_types SET reserve_fee = $2, meter_type_name = COALESCE(NULLIF($3, ''), meter_type_name), updated_at = NOW() WHERE id = $1`, meterTypeID, cmd.ReserveFee, strings.TrimSpace(cmd.MeterTypeName)); err != nil {
		return application.MeterRateConfig{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE tw_meter_type_rate_configs SET vat = $2, updated_at = NOW() WHERE id = $1`, foundID, cmd.VatPercent); err != nil {
		return application.MeterRateConfig{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE organizations SET vat = $2, updated_at = NOW() WHERE id = $1`, foundOrgID, cmd.VatPercent); err != nil {
		return application.MeterRateConfig{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM tw_meter_type_rate_tiers WHERE meter_type_rate_config_id = $1`, foundID); err != nil {
		return application.MeterRateConfig{}, err
	}
	for _, t := range cmd.Tiers {
		if _, err := tx.Exec(ctx, `
INSERT INTO tw_meter_type_rate_tiers (meter_type_rate_config_id, tier_order, min_units, max_units, rate_per_unit, comment)
VALUES ($1, $2, $3, $4, $5, $6)
`, foundID, t.TierOrder, t.MinUnits, t.MaxUnits, t.RatePerUnit, t.Comment); err != nil {
			return application.MeterRateConfig{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return application.MeterRateConfig{}, err
	}
	return s.GetActiveRateConfig(ctx, &foundOrgID)
}

func (s *Store) ListPeriods(ctx context.Context, orgID *int64) ([]application.InvoicePeriod, error) {
	const q = `
SELECT id, org_id, inv_p_name, startdate::text, enddate::text, status
FROM invoice_period
WHERE ($1::bigint IS NULL OR org_id = $1)
ORDER BY id DESC
`
	rows, err := s.db.Query(ctx, q, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.InvoicePeriod{}
	for rows.Next() {
		var p application.InvoicePeriod
		if err := rows.Scan(&p.ID, &p.OrgID, &p.PeriodName, &p.StartDate, &p.EndDate, &p.Status); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) CreatePeriod(ctx context.Context, orgID int64, cmd application.CreateInvoicePeriodCommand) (application.InvoicePeriod, error) {
	const q = `
INSERT INTO invoice_period (org_id, inv_p_name, startdate, enddate, status)
VALUES ($1, $2, COALESCE(NULLIF($3, '')::date, CURRENT_DATE), COALESCE(NULLIF($4, '')::date, (CURRENT_DATE + INTERVAL '30 days')::date), 'active')
RETURNING id, org_id, inv_p_name, startdate::text, enddate::text, status
`
	var p application.InvoicePeriod
	err := s.db.QueryRow(ctx, q, orgID, strings.TrimSpace(cmd.PeriodName), strings.TrimSpace(cmd.StartDate), strings.TrimSpace(cmd.EndDate)).
		Scan(&p.ID, &p.OrgID, &p.PeriodName, &p.StartDate, &p.EndDate, &p.Status)
	return p, err
}

func (s *Store) ListMeters(ctx context.Context, orgID *int64, zoneID *int64, query string) ([]application.WaterMeter, error) {
	const q = `
SELECT m.meter_id, m.org_id, m.user_id,
       COALESCE(u.prefix || u.firstname || ' ' || u.lastname, m.submeter_name),
       COALESCE(u.image, ''), COALESCE(u.firstname, ''), COALESCE(u.lastname, ''),
       COALESCE(u.house_no, ''), m.meternumber, m.factory_no, m.submeter_name, m.meter_address,
       m.undertake_zone_id, COALESCE(z.zone_name, ''),
       m.undertake_subzone_id, COALESCE(sz.subzone_name, ''),
       COALESCE(m.metertype_id, 1), COALESCE(mt.meter_type_name, 'ประปาครัวเรือน'),
       m.status, m.owe_count, m.cutmeter, m.last_meter_recording::float8
FROM tw_meter_infos m
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN zones z ON z.id = m.undertake_zone_id
LEFT JOIN subzones sz ON sz.id = m.undertake_subzone_id
LEFT JOIN tw_meter_types mt ON mt.id = m.metertype_id
WHERE ($1::bigint IS NULL OR m.org_id = $1)
  AND ($2::bigint IS NULL OR m.undertake_zone_id = $2)
  AND ($3::text = '' OR m.meternumber ILIKE '%' || $3 || '%' OR m.submeter_name ILIKE '%' || $3 || '%' OR m.meter_address ILIKE '%' || $3 || '%')
ORDER BY m.meter_id
`
	rows, err := s.db.Query(ctx, q, orgID, zoneID, strings.TrimSpace(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.WaterMeter{}
	for rows.Next() {
		var m application.WaterMeter
		var img, fn, ln string
		if err := rows.Scan(
			&m.MeterID, &m.OrgID, &m.UserID, &m.HomeownerName,
			&img, &fn, &ln, &m.HouseNo, &m.MeterNumber, &m.FactoryNo, &m.SubmeterName, &m.MeterAddress,
			&m.UndertakeZoneID, &m.ZoneName, &m.UndertakeSubzoneID, &m.SubzoneName,
			&m.MeterTypeID, &m.MeterTypeName, &m.Status, &m.OweCount, &m.CutMeter, &m.LastMeterRecording,
		); err != nil {
			return nil, err
		}
		m.HomeownerAvatarURL = application.ResolveAvatarURL(img, fn, ln)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) CreateMeter(ctx context.Context, orgID int64, cmd application.CreateWaterMeterCommand) (application.WaterMeter, error) {
	zoneID := cmd.ZoneID
	if zoneID <= 0 {
		zoneID = 1
	}
	subID := cmd.SubzoneID
	if subID <= 0 {
		subID = 1
	}
	const q = `
INSERT INTO tw_meter_infos (org_id, user_id, meternumber, factory_no, submeter_name, meter_address, undertake_zone_id, undertake_subzone_id, metertype_id, last_meter_recording)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
RETURNING meter_id
`
	var meterID int64
	err := s.db.QueryRow(ctx, q,
		orgID, cmd.UserID, strings.TrimSpace(cmd.MeterNumber), strings.TrimSpace(cmd.FactoryNo),
		strings.TrimSpace(cmd.SubmeterName), strings.TrimSpace(cmd.MeterAddress),
		zoneID, subID, int(math.Round(cmd.InitialReading)),
	).Scan(&meterID)
	if err != nil {
		return application.WaterMeter{}, err
	}
	meters, err := s.ListMeters(ctx, &orgID, nil, "")
	if err != nil {
		return application.WaterMeter{}, err
	}
	for _, m := range meters {
		if m.MeterID == meterID {
			return m, nil
		}
	}
	return application.WaterMeter{}, application.ErrNotFound
}

func (s *Store) RecordMeterReading(ctx context.Context, orgID int64, recorderID int64, cmd application.RecordMeterReadingCommand) (application.WaterInvoice, error) {
	if strings.TrimSpace(cmd.ClientReadingID) != "" {
		existing, err := s.ListInvoices(ctx, &orgID, "", nil)
		if err == nil {
			for _, inv := range existing {
				if inv.ClientReadingID == strings.TrimSpace(cmd.ClientReadingID) {
					return inv, nil
				}
			}
		}
	}

	rc, err := s.GetActiveRateConfig(ctx, &orgID)
	if err != nil {
		return application.WaterInvoice{}, err
	}

	var lastReading float64
	err = s.db.QueryRow(ctx, `SELECT last_meter_recording::float8 FROM tw_meter_infos WHERE meter_id = $1`, cmd.MeterID).Scan(&lastReading)
	if err != nil {
		return application.WaterInvoice{}, application.ErrNotFound
	}
	if cmd.CurrentMeter < lastReading {
		return application.WaterInvoice{}, application.ErrBadRequest
	}

	unitsUsed := math.Max(0, cmd.CurrentMeter-lastReading)
	reserveFee := cmd.ReserveFee
	if reserveFee <= 0 {
		reserveFee = rc.ReserveFee
	}
	vatPct := cmd.VatPercent
	if vatPct <= 0 {
		vatPct = rc.VatPercent
	}
	bill := application.CalculateProgressiveWaterBill(unitsUsed, rc.Tiers, reserveFee, vatPct)

	const qIns = `
WITH ins AS (
    INSERT INTO tw_invoice (
        inv_no, client_reading_id, org_id, meter_id_fk, inv_period_id_fk,
        lastmeter, currentmeter, water_used, paid, reserve_meter, vat, totalpaid,
        reading_photo_url, ocr_text, ocr_confidence, status, recorder_id
    ) VALUES (
        $1, NULLIF($2, ''), $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, 'invoice', $16
    ) RETURNING id
), upd AS (
    UPDATE tw_meter_infos
    SET last_meter_recording = $17, owe_count = owe_count + 1, updated_at = NOW()
    WHERE meter_id = $4
)
SELECT id FROM ins
`
	var invID int64
	err = s.db.QueryRow(ctx, qIns,
		strings.TrimSpace(cmd.InvoiceNo), strings.TrimSpace(cmd.ClientReadingID), orgID, cmd.MeterID, cmd.PeriodID,
		lastReading, cmd.CurrentMeter, bill.UnitsUsed, bill.WaterCharge, bill.ReserveFee, bill.VatAmount, bill.TotalPayable,
		strings.TrimSpace(cmd.ReadingPhotoURL), strings.TrimSpace(cmd.OCRText), cmd.OCRConfidence, recorderID,
		int(math.Round(cmd.CurrentMeter)),
	).Scan(&invID)
	if err != nil {
		return application.WaterInvoice{}, err
	}

	invoices, err := s.ListInvoices(ctx, &orgID, "", nil)
	if err != nil {
		return application.WaterInvoice{}, err
	}
	for _, inv := range invoices {
		if inv.ID == invID {
			return inv, nil
		}
	}
	return application.WaterInvoice{}, application.ErrNotFound
}

func (s *Store) ListReadings(ctx context.Context, orgID *int64, filter application.MeterReadingFilter) ([]application.MeterReadingItem, error) {
	status := strings.ToLower(strings.TrimSpace(filter.Status))
	out := []application.MeterReadingItem{}

	resolvedPeriodID := filter.PeriodID
	var resolvedPeriodName string
	if resolvedPeriodID == nil || *resolvedPeriodID <= 0 {
		const qActivePeriod = `
SELECT id, COALESCE(inv_p_name, '')
FROM invoice_period
WHERE ($1::bigint IS NULL OR org_id = $1)
  AND LOWER(status) = 'active'
ORDER BY id DESC
LIMIT 1
`
		var activeID int64
		if err := s.db.QueryRow(ctx, qActivePeriod, orgID).Scan(&activeID, &resolvedPeriodName); err == nil && activeID > 0 {
			resolvedPeriodID = &activeID
		}
	} else {
		const qPeriodName = `
SELECT COALESCE(inv_p_name, '')
FROM invoice_period
WHERE id = $1
  AND ($2::bigint IS NULL OR org_id = $2)
LIMIT 1
`
		_ = s.db.QueryRow(ctx, qPeriodName, *resolvedPeriodID, orgID).Scan(&resolvedPeriodName)
	}

	if status == "" || status == "recorded" {
		const qRecorded = `
SELECT inv.id, inv.inv_no, inv.org_id, inv.meter_id_fk,
       COALESCE(m.meternumber, ''), COALESCE(m.submeter_name, ''),
       COALESCE(u.house_no, ''), COALESCE(z.zone_name, ''), m.route_id,
       inv.inv_period_id_fk, COALESCE(p.inv_p_name, ''),
       inv.lastmeter::float8, inv.currentmeter::float8, inv.water_used::float8,
       inv.totalpaid::float8, inv.status, COALESCE(inv.recorded_at::text, '')
FROM tw_invoice inv
INNER JOIN tw_meter_infos m ON m.meter_id = inv.meter_id_fk
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN zones z ON z.id = m.undertake_zone_id
LEFT JOIN invoice_period p ON p.id = inv.inv_period_id_fk
WHERE ($1::bigint IS NULL OR inv.org_id = $1)
  AND ($2::bigint IS NULL OR inv.inv_period_id_fk = $2)
  AND ($3::bigint IS NULL OR m.route_id = $3)
ORDER BY inv.id DESC
`
		rows, err := s.db.Query(ctx, qRecorded, orgID, resolvedPeriodID, filter.RouteID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item application.MeterReadingItem
			var current float64
			if err := rows.Scan(
				&item.ID, &item.InvoiceNo, &item.OrgID, &item.MeterID,
				&item.MeterNumber, &item.HomeownerName,
				&item.HouseNo, &item.ZoneName, &item.RouteID,
				&item.PeriodID, &item.PeriodName,
				&item.LastMeter, &current, &item.WaterUsed,
				&item.TotalPaid, &item.InvoiceStatus, &item.RecordedAt,
			); err != nil {
				rows.Close()
				return nil, err
			}
			item.CurrentMeter = &current
			item.ReadingStatus = "recorded"
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}

	if status == "" || status == "pending" {
		const qPending = `
SELECT m.org_id, m.meter_id, COALESCE(m.meternumber, ''), COALESCE(m.submeter_name, ''),
       COALESCE(u.house_no, ''), COALESCE(z.zone_name, ''), m.route_id,
       m.last_meter_recording::float8
FROM tw_meter_infos m
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN zones z ON z.id = m.undertake_zone_id
LEFT JOIN tw_invoice inv
  ON inv.meter_id_fk = m.meter_id
  AND inv.org_id = m.org_id
  AND ($2::bigint IS NULL OR inv.inv_period_id_fk = $2)
WHERE ($1::bigint IS NULL OR m.org_id = $1)
  AND ($3::bigint IS NULL OR m.route_id = $3)
  AND inv.id IS NULL
ORDER BY m.meter_id ASC
`
		rows, err := s.db.Query(ctx, qPending, orgID, resolvedPeriodID, filter.RouteID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item application.MeterReadingItem
			if err := rows.Scan(
				&item.OrgID, &item.MeterID, &item.MeterNumber, &item.HomeownerName,
				&item.HouseNo, &item.ZoneName, &item.RouteID,
				&item.LastMeter,
			); err != nil {
				rows.Close()
				return nil, err
			}
			if resolvedPeriodID != nil {
				item.PeriodID = *resolvedPeriodID
			}
			item.PeriodName = resolvedPeriodName
			item.ReadingStatus = "pending"
			out = append(out, item)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}

	return out, nil
}

func (s *Store) ListInvoices(ctx context.Context, orgID *int64, status string, periodID *int64) ([]application.WaterInvoice, error) {
	const q = `
SELECT inv.id, inv.inv_no, COALESCE(inv.client_reading_id, ''), inv.org_id, COALESCE(o.org_name, 'อบต.ห้องแซง'),
       inv.meter_id_fk, COALESCE(m.meternumber, ''), COALESCE(m.submeter_name, ''),
       COALESCE(u.house_no, ''), COALESCE(z.zone_name, ''),
       inv.inv_period_id_fk, COALESCE(p.inv_p_name, ''),
       inv.lastmeter::float8, inv.currentmeter::float8, inv.water_used::float8,
       inv.paid::float8, inv.reserve_meter::float8, inv.vat::float8, inv.totalpaid::float8,
       inv.reading_photo_url, inv.ocr_text, inv.ocr_confidence::float8, inv.status,
       COALESCE(inv.payment_method, ''), COALESCE(inv.receipt_no, ''), COALESCE(inv.paid_at::text, ''), COALESCE(inv.cashier_id, 0),
       inv.recorded_at::text
FROM tw_invoice inv
LEFT JOIN organizations o ON o.id = inv.org_id
LEFT JOIN tw_meter_infos m ON m.meter_id = inv.meter_id_fk
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN zones z ON z.id = m.undertake_zone_id
LEFT JOIN invoice_period p ON p.id = inv.inv_period_id_fk
WHERE ($1::bigint IS NULL OR inv.org_id = $1)
  AND ($2::text = '' OR inv.status = $2)
  AND ($3::bigint IS NULL OR inv.inv_period_id_fk = $3)
ORDER BY inv.id DESC
`
	rows, err := s.db.Query(ctx, q, orgID, strings.TrimSpace(status), periodID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.WaterInvoice{}
	for rows.Next() {
		var inv application.WaterInvoice
		if err := rows.Scan(
			&inv.ID, &inv.InvoiceNo, &inv.ClientReadingID, &inv.OrgID, &inv.OrgName,
			&inv.MeterID, &inv.MeterNumber, &inv.HomeownerName, &inv.HouseNo, &inv.ZoneName,
			&inv.PeriodID, &inv.PeriodName, &inv.LastMeter, &inv.CurrentMeter, &inv.WaterUsed,
			&inv.Paid, &inv.ReserveMeter, &inv.Vat, &inv.TotalPaid,
			&inv.ReadingPhotoURL, &inv.OCRText, &inv.OCRConfidence, &inv.Status,
			&inv.PaymentMethod, &inv.ReceiptNo, &inv.PaidAt, &inv.CashierID,
			&inv.RecordedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	return out, rows.Err()
}

func (s *Store) PayInvoice(ctx context.Context, orgID *int64, cmd application.PayWaterInvoiceCommand) (application.WaterInvoice, error) {
	const q = `
WITH target AS (
    SELECT id, org_id, meter_id_fk, paid, vat, reserve_meter, totalpaid
    FROM tw_invoice
    WHERE id = $1
), ins_acc AS (
    INSERT INTO tw_acc_transactions (org_id, meter_id_fk, paidsum, vatsum, reserve_meter_sum, totalpaidsum, payment_method, status, cashier)
    SELECT org_id, meter_id_fk, paid, vat, reserve_meter, totalpaid, COALESCE(NULLIF($2, ''), 'cash'), '1', $3
    FROM target
    RETURNING id
)
UPDATE tw_invoice inv
SET status = 'paid',
    payment_method = COALESCE(NULLIF($2, ''), 'cash'),
    receipt_no = 'RC-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(inv.id::text, 4, '0'),
    paid_at = NOW(),
    cashier_id = $3,
    acc_trans_id_fk = ins_acc.id,
    updated_at = NOW()
FROM ins_acc
WHERE inv.id = $1
`
	_, err := s.db.Exec(ctx, q, cmd.InvoiceID, strings.TrimSpace(cmd.PaymentMethod), cmd.CashierID)
	if err != nil {
		return application.WaterInvoice{}, err
	}
	invoices, err := s.ListInvoices(ctx, orgID, "", nil)
	if err != nil {
		return application.WaterInvoice{}, err
	}
	for _, inv := range invoices {
		if inv.ID == cmd.InvoiceID {
			return inv, nil
		}
	}
	return application.WaterInvoice{}, application.ErrNotFound
}

func (s *Store) GetLiffPortalData(ctx context.Context, lineUserID, meterNumber, houseNo string) (application.LiffResidentPortalData, error) {
	users, err := s.ListHomeowners(ctx, nil, "")
	if err != nil || len(users) == 0 {
		return application.LiffResidentPortalData{}, application.ErrNotFound
	}
	meters, _ := s.ListMeters(ctx, nil, nil, "")
	invoices, _ := s.ListInvoices(ctx, nil, "", nil)

	var selected *application.HomeownerUser
	for i := range users {
		if lineUserID != "" && strings.EqualFold(users[i].LineUserID, lineUserID) {
			u := users[i]
			selected = &u
			break
		}
		if houseNo != "" && strings.EqualFold(users[i].HouseNo, houseNo) {
			u := users[i]
			selected = &u
			break
		}
	}
	if selected == nil && meterNumber != "" {
		for _, m := range meters {
			if strings.EqualFold(m.MeterNumber, meterNumber) {
				for i := range users {
					if users[i].ID == m.UserID {
						u := users[i]
						selected = &u
						break
					}
				}
			}
		}
	}
	if selected == nil {
		u := users[0]
		selected = &u
	}

	var userMeters []application.WaterMeter
	meterSet := map[int64]bool{}
	for _, m := range meters {
		if m.UserID == selected.ID {
			userMeters = append(userMeters, m)
			meterSet[m.MeterID] = true
		}
	}
	var userInvoices []application.WaterInvoice
	var unpaidTotal float64
	for _, inv := range invoices {
		if meterSet[inv.MeterID] {
			userInvoices = append(userInvoices, inv)
			if inv.Status != "paid" {
				unpaidTotal += inv.TotalPaid
			}
		}
	}
	return application.LiffResidentPortalData{
		Homeowner:   *selected,
		Meters:      userMeters,
		Invoices:    userInvoices,
		UnpaidTotal: math.Round(unpaidTotal*100) / 100,
	}, nil
}

func (s *Store) LinkLiffAccount(ctx context.Context, cmd application.LiffLinkAccountCommand) (application.LiffResidentPortalData, error) {
	_, _ = s.db.Exec(ctx, `
UPDATE users u
SET line_user_id = $1, updated_at = NOW()
FROM tw_meter_infos m
WHERE m.user_id = u.id AND LOWER(m.meternumber) = LOWER($2)
`, strings.TrimSpace(cmd.LineUserID), strings.TrimSpace(cmd.MeterNumber))
	return s.GetLiffPortalData(ctx, cmd.LineUserID, cmd.MeterNumber, cmd.HouseNo)
}
