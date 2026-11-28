package dto

import (
	"github.com/labstack/echo/v4"
	"github.com/pobx/water-smart-bill/backend-go/application"
)

type UpsertOrganizationDTO struct {
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

func NewUpsertOrganizationDTO() *UpsertOrganizationDTO {
	return &UpsertOrganizationDTO{}
}

func (d *UpsertOrganizationDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *UpsertOrganizationDTO) ConvertToEntity() (application.UpsertOrganizationCommand, error) {
	cmd := application.UpsertOrganizationCommand{
		Code:        d.Code,
		Name:        d.Name,
		Address:     d.Address,
		TambonID:    d.TambonID,
		DistrictID:  d.DistrictID,
		ProvinceID:  d.ProvinceID,
		Zipcode:     d.Zipcode,
		Phone:       d.Phone,
		DeptName:    d.DeptName,
		HeadName:    d.HeadName,
		FinHeadName: d.FinHeadName,
		TwHeadName:  d.TwHeadName,
		LogoImg:     d.LogoImg,
		MeterPrefix: d.MeterPrefix,
		VatRate:     d.VatRate,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.UpsertOrganizationCommand{}, err
	}
	return cmd, nil
}

type CreateZoneDTO struct {
	TambonID    int64  `json:"tambon_id"`
	MooNo       int    `json:"moo_no"`
	ZoneName    string `json:"zone_name"`
	SubzoneName string `json:"subzone_name"`
	Location    string `json:"location"`
}

func NewCreateZoneDTO() *CreateZoneDTO {
	return &CreateZoneDTO{}
}

func (d *CreateZoneDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *CreateZoneDTO) ConvertToEntity() (application.CreateZoneCommand, error) {
	cmd := application.CreateZoneCommand{
		TambonID:    d.TambonID,
		MooNo:       d.MooNo,
		ZoneName:    d.ZoneName,
		SubzoneName: d.SubzoneName,
		Location:    d.Location,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.CreateZoneCommand{}, err
	}
	return cmd, nil
}

type CreateHomeownerDTO struct {
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

func NewCreateHomeownerDTO() *CreateHomeownerDTO {
	return &CreateHomeownerDTO{}
}

func (d *CreateHomeownerDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *CreateHomeownerDTO) ConvertToEntity() (application.CreateHomeownerCommand, error) {
	cmd := application.CreateHomeownerCommand{
		Username:   d.Username,
		Prefix:     d.Prefix,
		FirstName:  d.FirstName,
		LastName:   d.LastName,
		HouseNo:    d.HouseNo,
		Address:    d.Address,
		ZoneID:     d.ZoneID,
		SubzoneID:  d.SubzoneID,
		TambonCode: d.TambonCode,
		Phone:      d.Phone,
		LineUserID: d.LineUserID,
		ImageURL:   d.ImageURL,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.CreateHomeownerCommand{}, err
	}
	return cmd, nil
}

type SaveRateConfigDTO struct {
	MeterTypeName string                 `json:"meter_type_name"`
	ReserveFee    float64                `json:"reserve_fee"`
	VatPercent    float64                `json:"vat"`
	Tiers         []application.RateTier `json:"tiers"`
}

func NewSaveRateConfigDTO() *SaveRateConfigDTO {
	return &SaveRateConfigDTO{}
}

func (d *SaveRateConfigDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *SaveRateConfigDTO) ConvertToEntity() (application.SaveRateConfigCommand, error) {
	cmd := application.SaveRateConfigCommand{
		MeterTypeName: d.MeterTypeName,
		ReserveFee:    d.ReserveFee,
		VatPercent:    d.VatPercent,
		Tiers:         d.Tiers,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.SaveRateConfigCommand{}, err
	}
	return cmd, nil
}

type UpdateRateTierDTO struct {
	TierOrder   int      `json:"tier_order"`
	MinUnits    *int     `json:"min_units"`
	MaxUnits    *int     `json:"max_units"`
	RatePerUnit *float64 `json:"rate_per_unit"`
	From        *int     `json:"from"`
	To          *int     `json:"to"`
	Rate        *float64 `json:"rate"`
	Comment     string   `json:"comment"`
}

type UpdateRateConfigDTO struct {
	PeriodID      *int64              `json:"period_id"`
	MeterTypeName string              `json:"meter_type_name"`
	ReserveFee    float64             `json:"reserve_fee"`
	VatPercent    float64             `json:"vat"`
	Tiers         []UpdateRateTierDTO `json:"tiers"`
}

func NewUpdateRateConfigDTO() *UpdateRateConfigDTO {
	return &UpdateRateConfigDTO{}
}

func (d *UpdateRateConfigDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *UpdateRateConfigDTO) ConvertToEntity() (application.UpdateRateConfigCommand, error) {
	tiers := make([]application.RateTier, 0, len(d.Tiers))
	for i, item := range d.Tiers {
		minUnits := 0
		if item.MinUnits != nil {
			minUnits = *item.MinUnits
		} else if item.From != nil {
			minUnits = *item.From
		}

		var maxUnits *int
		if item.MaxUnits != nil {
			v := *item.MaxUnits
			maxUnits = &v
		} else if item.To != nil {
			v := *item.To
			maxUnits = &v
		}

		ratePerUnit := 0.0
		if item.RatePerUnit != nil {
			ratePerUnit = *item.RatePerUnit
		} else if item.Rate != nil {
			ratePerUnit = *item.Rate
		}

		order := item.TierOrder
		if order <= 0 {
			order = i + 1
		}

		tiers = append(tiers, application.RateTier{
			TierOrder:   order,
			MinUnits:    minUnits,
			MaxUnits:    maxUnits,
			RatePerUnit: ratePerUnit,
			Comment:     item.Comment,
		})
	}

	cmd := application.UpdateRateConfigCommand{
		PeriodID:      d.PeriodID,
		MeterTypeName: d.MeterTypeName,
		ReserveFee:    d.ReserveFee,
		VatPercent:    d.VatPercent,
		Tiers:         tiers,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.UpdateRateConfigCommand{}, err
	}
	return cmd, nil
}

type CreateInvoicePeriodDTO struct {
	PeriodName string `json:"period_name"`
	StartDate  string `json:"start_date"`
	EndDate    string `json:"end_date"`
}

func NewCreateInvoicePeriodDTO() *CreateInvoicePeriodDTO {
	return &CreateInvoicePeriodDTO{}
}

func (d *CreateInvoicePeriodDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *CreateInvoicePeriodDTO) ConvertToEntity() (application.CreateInvoicePeriodCommand, error) {
	cmd := application.CreateInvoicePeriodCommand{
		PeriodName: d.PeriodName,
		StartDate:  d.StartDate,
		EndDate:    d.EndDate,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.CreateInvoicePeriodCommand{}, err
	}
	return cmd, nil
}

type CreateWaterMeterDTO struct {
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

func NewCreateWaterMeterDTO() *CreateWaterMeterDTO {
	return &CreateWaterMeterDTO{}
}

func (d *CreateWaterMeterDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *CreateWaterMeterDTO) ConvertToEntity() (application.CreateWaterMeterCommand, error) {
	cmd := application.CreateWaterMeterCommand{
		UserID:         d.UserID,
		MeterNumber:    d.MeterNumber,
		FactoryNo:      d.FactoryNo,
		SubmeterName:   d.SubmeterName,
		MeterAddress:   d.MeterAddress,
		ZoneID:         d.ZoneID,
		SubzoneID:      d.SubzoneID,
		MeterTypeID:    d.MeterTypeID,
		InitialReading: d.InitialReading,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.CreateWaterMeterCommand{}, err
	}
	return cmd, nil
}

type RecordMeterReadingDTO struct {
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

func NewRecordMeterReadingDTO() *RecordMeterReadingDTO {
	return &RecordMeterReadingDTO{}
}

func (d *RecordMeterReadingDTO) Bind(c echo.Context) error {
	if err := c.Bind(d); err != nil {
		return err
	}
	if d.ClientReadingID == "" {
		d.ClientReadingID = c.Request().Header.Get("Idempotency-Key")
	}
	return nil
}

func (d *RecordMeterReadingDTO) ConvertToEntity() (application.RecordMeterReadingCommand, error) {
	cmd := application.RecordMeterReadingCommand{
		ClientReadingID: d.ClientReadingID,
		InvoiceNo:       d.InvoiceNo,
		MeterID:         d.MeterID,
		PeriodID:        d.PeriodID,
		CurrentMeter:    d.CurrentMeter,
		ReserveFee:      d.ReserveFee,
		VatPercent:      d.VatPercent,
		ReadingPhotoURL: d.ReadingPhotoURL,
		OCRText:         d.OCRText,
		OCRConfidence:   d.OCRConfidence,
		RecordedAt:      d.RecordedAt,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.RecordMeterReadingCommand{}, err
	}
	return cmd, nil
}

type OfflineSyncBatchDTO struct {
	Readings []RecordMeterReadingDTO `json:"readings"`
}

func NewOfflineSyncBatchDTO() *OfflineSyncBatchDTO {
	return &OfflineSyncBatchDTO{}
}

func (d *OfflineSyncBatchDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *OfflineSyncBatchDTO) ConvertToEntity() (application.OfflineSyncBatchCommand, error) {
	cmds := make([]application.RecordMeterReadingCommand, 0, len(d.Readings))
	for _, item := range d.Readings {
		cmd, err := item.ConvertToEntity()
		if err != nil {
			return application.OfflineSyncBatchCommand{}, err
		}
		cmds = append(cmds, cmd)
	}
	return application.OfflineSyncBatchCommand{Readings: cmds}, nil
}

type LiffLinkAccountDTO struct {
	LineUserID  string `json:"line_user_id"`
	MeterNumber string `json:"meternumber"`
	HouseNo     string `json:"house_no"`
}

func NewLiffLinkAccountDTO() *LiffLinkAccountDTO {
	return &LiffLinkAccountDTO{}
}

func (d *LiffLinkAccountDTO) Bind(c echo.Context) error {
	return c.Bind(d)
}

func (d *LiffLinkAccountDTO) ConvertToEntity() (application.LiffLinkAccountCommand, error) {
	cmd := application.LiffLinkAccountCommand{
		LineUserID:  d.LineUserID,
		MeterNumber: d.MeterNumber,
		HouseNo:     d.HouseNo,
	}
	if _, err := cmd.IsValid(); err != nil {
		return application.LiffLinkAccountCommand{}, err
	}
	return cmd, nil
}
