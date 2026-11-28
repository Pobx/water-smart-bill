package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/pobx/water-smart-bill/backend-go/adapters/dto"
	"github.com/pobx/water-smart-bill/backend-go/application"
	"github.com/pobx/water-smart-bill/backend-go/application/ports"
)

const ClaimsContextKey = "auth_claims"

type ProblemDetail struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

func WriteProblem(c echo.Context, status int, title, detail string) error {
	c.Response().Header().Set(echo.HeaderContentType, "application/problem+json")
	return c.JSON(status, ProblemDetail{
		Type:   "about:blank",
		Title:  title,
		Status: status,
		Detail: detail,
	})
}

func MapDomainError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, application.ErrUnauthorized):
		return WriteProblem(c, http.StatusUnauthorized, "Unauthorized", err.Error())
	case errors.Is(err, application.ErrForbidden):
		return WriteProblem(c, http.StatusForbidden, "Forbidden", err.Error())
	case errors.Is(err, application.ErrNotFound):
		return WriteProblem(c, http.StatusNotFound, "Not Found", err.Error())
	case errors.Is(err, application.ErrBadRequest):
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", err.Error())
	case errors.Is(err, application.ErrConflict):
		return WriteProblem(c, http.StatusConflict, "Conflict", err.Error())
	default:
		return WriteProblem(c, http.StatusInternalServerError, "Internal Server Error", err.Error())
	}
}

func GetClaims(c echo.Context) application.Claims {
	if val := c.Get(ClaimsContextKey); val != nil {
		if cl, ok := val.(application.Claims); ok {
			return cl
		}
	}
	return application.Claims{}
}

// WaterBillRestHandler follows vinisantos.dev Hexagonal Architecture REST Handler adapter.
type WaterBillRestHandler struct {
	Service   ports.WaterBillServiceInterface
	Blacklist ports.TokenBlacklistInterface
	UploadDir string
}

func NewWaterBillRestHandler(service ports.WaterBillServiceInterface, blacklist ports.TokenBlacklistInterface, uploadDir string) *WaterBillRestHandler {
	return &WaterBillRestHandler{
		Service:   service,
		Blacklist: blacklist,
		UploadDir: uploadDir,
	}
}

func (h *WaterBillRestHandler) DefaultAvatar(c echo.Context) error {
	name := c.QueryParam("name")
	svg := application.GenerateDefaultAvatarSVG(name)
	c.Response().Header().Set("Cache-Control", "public, max-age=86400")
	return c.Blob(http.StatusOK, "image/svg+xml", []byte(svg))
}

func (h *WaterBillRestHandler) GetLiffBills(c echo.Context) error {
	lineUserID := c.QueryParam("line_user_id")
	meterNumber := c.QueryParam("meternumber")
	houseNo := c.QueryParam("house_no")
	data, err := h.Service.GetLiffPortalData(c.Request().Context(), lineUserID, meterNumber, houseNo)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, data)
}

func (h *WaterBillRestHandler) LinkLiffAccount(c echo.Context) error {
	reqDTO := dto.NewLiffLinkAccountDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON payload")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	data, err := h.Service.LinkLiffAccount(c.Request().Context(), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, data)
}

func (h *WaterBillRestHandler) Logout(c echo.Context) error {
	claims := GetClaims(c)
	if h.Blacklist != nil && claims.JTI != "" {
		if err := h.Blacklist.RevokeToken(c.Request().Context(), claims.JTI, claims.ExpiresAt); err != nil {
			return MapDomainError(c, err)
		}
	}
	return c.JSON(http.StatusOK, map[string]any{
		"status":      "logged_out",
		"revoked_jti": claims.JTI,
	})
}

func (h *WaterBillRestHandler) GetMe(c echo.Context) error {
	claims := GetClaims(c)
	return c.JSON(http.StatusOK, map[string]any{
		"sub":                claims.Subject,
		"preferred_username": claims.Username,
		"roles":              claims.Roles,
		"org_id":             claims.OrgID,
		"jti":                claims.JTI,
	})
}

func (h *WaterBillRestHandler) GetOrganization(c echo.Context) error {
	org, err := h.Service.GetOrganization(c.Request().Context(), GetClaims(c))
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, org)
}

func (h *WaterBillRestHandler) UpsertOrganization(c echo.Context) error {
	reqDTO := dto.NewUpsertOrganizationDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	org, err := h.Service.UpsertOrganization(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, org)
}

func (h *WaterBillRestHandler) ListTambons(c echo.Context) error {
	items, err := h.Service.ListTambons(c.Request().Context())
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

func (h *WaterBillRestHandler) ListZones(c echo.Context) error {
	zones, err := h.Service.ListZones(c.Request().Context(), GetClaims(c))
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": zones})
}

func (h *WaterBillRestHandler) CreateZone(c echo.Context) error {
	reqDTO := dto.NewCreateZoneDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	z, err := h.Service.CreateZone(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusCreated, z)
}

func (h *WaterBillRestHandler) ListHomeowners(c echo.Context) error {
	q := c.QueryParam("q")
	users, err := h.Service.ListHomeowners(c.Request().Context(), GetClaims(c), q)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": users})
}

func (h *WaterBillRestHandler) CreateHomeowner(c echo.Context) error {
	reqDTO := dto.NewCreateHomeownerDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	u, err := h.Service.CreateHomeowner(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusCreated, u)
}

const maxAvatarUploadBytes = 5 * 1024 * 1024

var allowedAvatarExtensions = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".webp": true,
}

var allowedAvatarMIMEs = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
}

func isSafeAvatarURL(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return false
	}
	lower := strings.ToLower(trimmed)
	return strings.HasPrefix(lower, "/") ||
		strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:image/png;base64,") ||
		strings.HasPrefix(lower, "data:image/jpeg;base64,") ||
		strings.HasPrefix(lower, "data:image/webp;base64,")
}

func (h *WaterBillRestHandler) UploadHomeownerAvatar(c echo.Context) error {
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid user id")
	}

	var avatarURL string
	fileHeader, fileErr := c.FormFile("avatar")
	if fileErr == nil && fileHeader != nil {
		if fileHeader.Size <= 0 || fileHeader.Size > maxAvatarUploadBytes {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "avatar file size must be between 1B and 5MB")
		}
		ext := strings.ToLower(filepath.Ext(filepath.Base(fileHeader.Filename)))
		if !allowedAvatarExtensions[ext] {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "unsupported avatar file extension (allowed: .png, .jpg, .jpeg, .webp)")
		}
		src, err := fileHeader.Open()
		if err != nil {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "cannot read uploaded file")
		}
		defer src.Close()

		data, err := io.ReadAll(io.LimitReader(src, maxAvatarUploadBytes+1))
		if err != nil || len(data) == 0 || len(data) > maxAvatarUploadBytes {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid avatar file payload")
		}
		detectedMIME := http.DetectContentType(data)
		if !allowedAvatarMIMEs[detectedMIME] {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid image MIME content type")
		}

		filename := fmt.Sprintf("user-%d-%d%s", userID, time.Now().UnixMilli(), ext)
		destPath := filepath.Join(h.UploadDir, "avatars", filename)
		if err := os.WriteFile(destPath, data, 0o644); err != nil {
			return WriteProblem(c, http.StatusInternalServerError, "Storage Error", err.Error())
		}
		avatarURL = "/uploads/avatars/" + filename
	} else {
		var body struct {
			AvatarURL string `json:"avatar_url"`
		}
		_ = c.Bind(&body)
		if !isSafeAvatarURL(body.AvatarURL) {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid or unsafe avatar_url scheme")
		}
		avatarURL = strings.TrimSpace(body.AvatarURL)
	}

	updated, err := h.Service.UpdateHomeownerAvatar(c.Request().Context(), GetClaims(c), userID, avatarURL)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, updated)
}

func (h *WaterBillRestHandler) GetActiveRateConfig(c echo.Context) error {
	rc, err := h.Service.GetActiveRateConfig(c.Request().Context(), GetClaims(c))
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, rc)
}

func (h *WaterBillRestHandler) SaveRateConfig(c echo.Context) error {
	reqDTO := dto.NewSaveRateConfigDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	rc, err := h.Service.SaveRateConfig(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, rc)
}

func (h *WaterBillRestHandler) UpdateRateConfig(c echo.Context) error {
	configID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || configID <= 0 {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid rate config id")
	}
	reqDTO := dto.NewUpdateRateConfigDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	rc, err := h.Service.UpdateRateConfig(c.Request().Context(), GetClaims(c), configID, cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, rc)
}

func (h *WaterBillRestHandler) ListPeriods(c echo.Context) error {
	periods, err := h.Service.ListPeriods(c.Request().Context(), GetClaims(c))
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": periods})
}

func (h *WaterBillRestHandler) CreatePeriod(c echo.Context) error {
	reqDTO := dto.NewCreateInvoicePeriodDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	p, err := h.Service.CreatePeriod(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusCreated, p)
}

func (h *WaterBillRestHandler) ListMeters(c echo.Context) error {
	var zoneID *int64
	if rawZ := c.QueryParam("zone_id"); rawZ != "" {
		if parsed, err := strconv.ParseInt(rawZ, 10, 64); err == nil {
			zoneID = &parsed
		}
	}
	meters, err := h.Service.ListMeters(c.Request().Context(), GetClaims(c), zoneID, c.QueryParam("q"))
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": meters})
}

func (h *WaterBillRestHandler) GetMeterRoutes(c echo.Context) error {
	var requestedOrgID *int64
	if rawOrg := c.QueryParam("org_id"); rawOrg != "" {
		parsed, err := strconv.ParseInt(rawOrg, 10, 64)
		if err != nil {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid org_id parameter")
		}
		requestedOrgID = &parsed
	}
	routes, err := h.Service.ListMeterRoutes(c.Request().Context(), GetClaims(c), requestedOrgID)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": routes})
}

func (h *WaterBillRestHandler) CreateMeter(c echo.Context) error {
	reqDTO := dto.NewCreateWaterMeterDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	m, err := h.Service.CreateMeter(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusCreated, m)
}

func (h *WaterBillRestHandler) GetOfflineBundle(c echo.Context) error {
	var zoneID *int64
	if rawZ := c.QueryParam("zone_id"); rawZ != "" {
		if parsed, err := strconv.ParseInt(rawZ, 10, 64); err == nil {
			zoneID = &parsed
		}
	}
	bundle, err := h.Service.GetOfflineBundle(c.Request().Context(), GetClaims(c), zoneID)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, bundle)
}

func (h *WaterBillRestHandler) ParseMeterOCR(c echo.Context) error {
	var body struct {
		OCRHint   string  `json:"ocr_hint"`
		LastMeter float64 `json:"last_meter"`
	}
	_ = c.Bind(&body)
	if strings.TrimSpace(body.OCRHint) == "" {
		body.OCRHint = c.FormValue("ocr_hint")
	}
	res, err := application.ParseMeterOCRReading(body.OCRHint, body.LastMeter)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *WaterBillRestHandler) ListReadings(c echo.Context) error {
	var requestedOrgID *int64
	if rawOrg := c.QueryParam("org_id"); rawOrg != "" {
		parsed, err := strconv.ParseInt(rawOrg, 10, 64)
		if err != nil {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid org_id parameter")
		}
		requestedOrgID = &parsed
	}
	var periodID *int64
	if rawP := c.QueryParam("period_id"); rawP != "" {
		parsed, err := strconv.ParseInt(rawP, 10, 64)
		if err != nil || parsed <= 0 {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid period_id parameter")
		}
		periodID = &parsed
	}
	var routeID *int64
	if rawR := c.QueryParam("route_id"); rawR != "" {
		parsed, err := strconv.ParseInt(rawR, 10, 64)
		if err != nil || parsed <= 0 {
			return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid route_id parameter")
		}
		routeID = &parsed
	}
	filter := application.MeterReadingFilter{
		PeriodID: periodID,
		Status:   c.QueryParam("status"),
		RouteID:  routeID,
	}
	items, err := h.Service.ListReadings(c.Request().Context(), GetClaims(c), requestedOrgID, filter)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

func (h *WaterBillRestHandler) RecordMeterReading(c echo.Context) error {
	reqDTO := dto.NewRecordMeterReadingDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	inv, err := h.Service.RecordMeterReading(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusCreated, inv)
}

func (h *WaterBillRestHandler) SyncOfflineReadings(c echo.Context) error {
	reqDTO := dto.NewOfflineSyncBatchDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	batch, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	res, err := h.Service.SyncOfflineReadings(c.Request().Context(), GetClaims(c), batch)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *WaterBillRestHandler) ListInvoices(c echo.Context) error {
	var periodID *int64
	if rawP := c.QueryParam("period_id"); rawP != "" {
		if parsed, err := strconv.ParseInt(rawP, 10, 64); err == nil {
			periodID = &parsed
		}
	}
	items, err := h.Service.ListInvoices(c.Request().Context(), GetClaims(c), c.QueryParam("status"), periodID)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

func (h *WaterBillRestHandler) PayInvoice(c echo.Context) error {
	invID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || invID <= 0 {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid invoice id")
	}
	var body struct {
		PaymentMethod string `json:"payment_method"`
	}
	_ = c.Bind(&body)
	inv, err := h.Service.PayInvoice(c.Request().Context(), GetClaims(c), application.PayWaterInvoiceCommand{
		InvoiceID:     invID,
		CashierID:     1,
		PaymentMethod: body.PaymentMethod,
	})
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, inv)
}

func (h *WaterBillRestHandler) GetOutstandingBalance(c echo.Context) error {
	userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || userID <= 0 {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid user id")
	}
	res, err := h.Service.GetOutstandingBalance(c.Request().Context(), GetClaims(c), userID)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *WaterBillRestHandler) PayInvoicesBulk(c echo.Context) error {
	reqDTO := dto.NewBulkPaymentDTO()
	if err := reqDTO.Bind(c); err != nil {
		return WriteProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
	}
	cmd, err := reqDTO.ConvertToEntity()
	if err != nil {
		return MapDomainError(c, err)
	}
	res, err := h.Service.PayInvoicesBulk(c.Request().Context(), GetClaims(c), cmd)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *WaterBillRestHandler) GetCollectionReport(c echo.Context) error {
	var periodID *int64
	if rawP := c.QueryParam("period_id"); rawP != "" {
		if parsed, err := strconv.ParseInt(rawP, 10, 64); err == nil {
			periodID = &parsed
		}
	}
	filter := application.CollectionReportFilter{
		PeriodID: periodID,
		Status:   c.QueryParam("status"),
	}

	format := strings.ToLower(c.QueryParam("format"))
	accept := c.Request().Header.Get("Accept")
	if format == "csv" || strings.Contains(accept, "text/csv") {
		csvBytes, err := h.Service.ExportCollectionReportCSV(c.Request().Context(), GetClaims(c), filter)
		if err != nil {
			return MapDomainError(c, err)
		}
		filename := fmt.Sprintf("collection-report-%s.csv", time.Now().Format("20060102-150405"))
		c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
		return c.Blob(http.StatusOK, "text/csv; charset=utf-8", csvBytes)
	}

	report, err := h.Service.GetCollectionReport(c.Request().Context(), GetClaims(c), filter)
	if err != nil {
		return MapDomainError(c, err)
	}
	return c.JSON(http.StatusOK, report)
}
