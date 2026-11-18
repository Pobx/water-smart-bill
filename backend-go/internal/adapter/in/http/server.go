package http

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
	"github.com/labstack/echo/v4/middleware"

	"github.com/pobx/water-smart-bill/backend-go/internal/app"
	"github.com/pobx/water-smart-bill/backend-go/internal/domain"
)

type contextKey string

const claimsKey contextKey = "auth_claims"

type ServerConfig struct {
	AppEnv           string
	Verifier         domain.TokenVerifier
	Blacklist        domain.TokenBlacklist
	WaterService     *app.WaterService
	UploadDir        string
	OpenAPISpec      []byte
	AllowDemoTokens  bool
}

type problemDetail struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail"`
}

func writeProblem(c echo.Context, status int, title, detail string) error {
	c.Response().Header().Set(echo.HeaderContentType, "application/problem+json")
	return c.JSON(status, problemDetail{
		Type:   "about:blank",
		Title:  title,
		Status: status,
		Detail: detail,
	})
}

func mapDomainError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, domain.ErrUnauthorized):
		return writeProblem(c, http.StatusUnauthorized, "Unauthorized", err.Error())
	case errors.Is(err, domain.ErrForbidden):
		return writeProblem(c, http.StatusForbidden, "Forbidden", err.Error())
	case errors.Is(err, domain.ErrNotFound):
		return writeProblem(c, http.StatusNotFound, "Not Found", err.Error())
	case errors.Is(err, domain.ErrBadRequest):
		return writeProblem(c, http.StatusBadRequest, "Bad Request", err.Error())
	default:
		return writeProblem(c, http.StatusInternalServerError, "Internal Server Error", err.Error())
	}
}

func NewServer(cfg ServerConfig) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "Idempotency-Key"},
	}))

	uploadDir := strings.TrimSpace(cfg.UploadDir)
	if uploadDir == "" {
		uploadDir = "/tmp/water-smart-bill-uploads"
	}
	_ = os.MkdirAll(filepath.Join(uploadDir, "avatars"), 0o755)
	_ = os.MkdirAll(filepath.Join(uploadDir, "meters"), 0o755)
	e.Static("/uploads", uploadDir)

	// Health & Readiness
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok", "env": cfg.AppEnv})
	})
	e.GET("/readyz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
	})

	// Non-Prod Swagger Gate (strictly disabled in production)
	isProd := strings.EqualFold(strings.TrimSpace(cfg.AppEnv), "production") || strings.EqualFold(strings.TrimSpace(cfg.AppEnv), "prod")
	if !isProd {
		e.GET("/api/v1/openapi.yaml", func(c echo.Context) error {
			return c.Blob(http.StatusOK, "application/yaml", cfg.OpenAPISpec)
		})
		e.GET("/swagger/*", func(c echo.Context) error {
			html := `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>Water Smart Bill API — Swagger UI (Non-Prod)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({ url: '/api/v1/openapi.yaml', dom_id: '#swagger-ui' });
    };
  </script>
</body>
</html>`
			return c.HTML(http.StatusOK, html)
		})
	}

	// Public Endpoints: Default Avatar SVG & LINE LIFF Resident Portal
	e.GET("/api/v1/avatars/default", func(c echo.Context) error {
		name := c.QueryParam("name")
		svg := domain.GenerateDefaultAvatarSVG(name)
		c.Response().Header().Set("Cache-Control", "public, max-age=86400")
		return c.Blob(http.StatusOK, "image/svg+xml", []byte(svg))
	})

	e.GET("/api/v1/liff/bills", func(c echo.Context) error {
		lineUserID := c.QueryParam("line_user_id")
		meterNumber := c.QueryParam("meternumber")
		houseNo := c.QueryParam("house_no")
		data, err := cfg.WaterService.GetLiffPortalData(c.Request().Context(), lineUserID, meterNumber, houseNo)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, data)
	})

	e.POST("/api/v1/liff/link", func(c echo.Context) error {
		var cmd domain.LiffLinkAccountCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON payload")
		}
		data, err := cfg.WaterService.LinkLiffAccount(c.Request().Context(), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, data)
	})

	// Protected API Group (Keycloak JWT + Redis Blacklist Check)
	api := e.Group("/api/v1", authMiddleware(cfg))

	api.POST("/auth/logout", func(c echo.Context) error {
		claims := getClaims(c)
		if cfg.Blacklist != nil && claims.JTI != "" {
			if err := cfg.Blacklist.RevokeToken(c.Request().Context(), claims.JTI, claims.ExpiresAt); err != nil {
				return mapDomainError(c, err)
			}
		}
		return c.JSON(http.StatusOK, map[string]any{
			"status":      "logged_out",
			"revoked_jti": claims.JTI,
		})
	})

	api.GET("/me", func(c echo.Context) error {
		claims := getClaims(c)
		return c.JSON(http.StatusOK, map[string]any{
			"sub":                claims.Subject,
			"preferred_username": claims.Username,
			"roles":              claims.Roles,
			"org_id":             claims.OrgID,
			"jti":                claims.JTI,
		})
	})

	// Master Data: SAO (อบต.), Tambons, Villages (Zones/Subzones), Homeowners & Avatars
	api.GET("/organizations", func(c echo.Context) error {
		org, err := cfg.WaterService.GetOrganization(c.Request().Context(), getClaims(c))
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, org)
	})

	api.POST("/organizations", func(c echo.Context) error {
		var cmd domain.UpsertOrganizationCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		org, err := cfg.WaterService.UpsertOrganization(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, org)
	})

	api.GET("/locations/tambons", func(c echo.Context) error {
		items, err := cfg.WaterService.ListTambons(c.Request().Context())
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": items})
	})

	api.GET("/zones", func(c echo.Context) error {
		zones, err := cfg.WaterService.ListZones(c.Request().Context(), getClaims(c))
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": zones})
	})

	api.POST("/zones", func(c echo.Context) error {
		var cmd domain.CreateZoneCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		z, err := cfg.WaterService.CreateZone(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusCreated, z)
	})

	api.GET("/users", func(c echo.Context) error {
		q := c.QueryParam("q")
		users, err := cfg.WaterService.ListHomeowners(c.Request().Context(), getClaims(c), q)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": users})
	})

	api.POST("/users", func(c echo.Context) error {
		var cmd domain.CreateHomeownerCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		u, err := cfg.WaterService.CreateHomeowner(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusCreated, u)
	})

	api.POST("/users/:id/avatar", func(c echo.Context) error {
		userID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || userID <= 0 {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid user id")
		}

		var avatarURL string
		fileHeader, fileErr := c.FormFile("avatar")
		if fileErr == nil && fileHeader != nil {
			src, err := fileHeader.Open()
			if err != nil {
				return writeProblem(c, http.StatusBadRequest, "Bad Request", "cannot read uploaded file")
			}
			defer src.Close()
			ext := filepath.Ext(fileHeader.Filename)
			if ext == "" {
				ext = ".png"
			}
			filename := fmt.Sprintf("user-%d-%d%s", userID, time.Now().UnixMilli(), ext)
			destPath := filepath.Join(uploadDir, "avatars", filename)
			dst, err := os.Create(destPath)
			if err != nil {
				return writeProblem(c, http.StatusInternalServerError, "Storage Error", err.Error())
			}
			defer dst.Close()
			if _, err := io.Copy(dst, src); err != nil {
				return writeProblem(c, http.StatusInternalServerError, "Storage Error", err.Error())
			}
			avatarURL = "/uploads/avatars/" + filename
		} else {
			var body struct {
				AvatarURL string `json:"avatar_url"`
			}
			_ = c.Bind(&body)
			avatarURL = body.AvatarURL
		}

		updated, err := cfg.WaterService.UpdateHomeownerAvatar(c.Request().Context(), getClaims(c), userID, avatarURL)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, updated)
	})

	// Tariffs, Periods, Meters & Readings
	api.GET("/tabwater/rate-configs", func(c echo.Context) error {
		rc, err := cfg.WaterService.GetActiveRateConfig(c.Request().Context(), getClaims(c))
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, rc)
	})

	api.POST("/tabwater/rate-configs", func(c echo.Context) error {
		var cmd domain.SaveRateConfigCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		rc, err := cfg.WaterService.SaveRateConfig(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, rc)
	})

	api.GET("/tabwater/periods", func(c echo.Context) error {
		periods, err := cfg.WaterService.ListPeriods(c.Request().Context(), getClaims(c))
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": periods})
	})

	api.POST("/tabwater/periods", func(c echo.Context) error {
		var cmd domain.CreateInvoicePeriodCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		p, err := cfg.WaterService.CreatePeriod(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusCreated, p)
	})

	api.GET("/tabwater/meters", func(c echo.Context) error {
		var zoneID *int64
		if rawZ := c.QueryParam("zone_id"); rawZ != "" {
			if parsed, err := strconv.ParseInt(rawZ, 10, 64); err == nil {
				zoneID = &parsed
			}
		}
		meters, err := cfg.WaterService.ListMeters(c.Request().Context(), getClaims(c), zoneID, c.QueryParam("q"))
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": meters})
	})

	api.POST("/tabwater/meters", func(c echo.Context) error {
		var cmd domain.CreateWaterMeterCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		m, err := cfg.WaterService.CreateMeter(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusCreated, m)
	})

	api.GET("/tabwater/offline-bundle", func(c echo.Context) error {
		var zoneID *int64
		if rawZ := c.QueryParam("zone_id"); rawZ != "" {
			if parsed, err := strconv.ParseInt(rawZ, 10, 64); err == nil {
				zoneID = &parsed
			}
		}
		bundle, err := cfg.WaterService.GetOfflineBundle(c.Request().Context(), getClaims(c), zoneID)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, bundle)
	})

	api.POST("/tabwater/ocr/meter-read", func(c echo.Context) error {
		var body struct {
			OCRHint   string  `json:"ocr_hint"`
			LastMeter float64 `json:"last_meter"`
		}
		_ = c.Bind(&body)
		if body.OCRHint == "" {
			body.OCRHint = c.FormValue("ocr_hint")
		}
		res, err := domain.ParseMeterOCRReading(body.OCRHint, body.LastMeter)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, res)
	})

	api.POST("/tabwater/readings", func(c echo.Context) error {
		var cmd domain.RecordMeterReadingCommand
		if err := c.Bind(&cmd); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		if cmd.ClientReadingID == "" {
			cmd.ClientReadingID = c.Request().Header.Get("Idempotency-Key")
		}
		inv, err := cfg.WaterService.RecordMeterReading(c.Request().Context(), getClaims(c), cmd)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusCreated, inv)
	})

	api.POST("/tabwater/readings/sync", func(c echo.Context) error {
		var batch domain.OfflineSyncBatchCommand
		if err := c.Bind(&batch); err != nil {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		}
		res, err := cfg.WaterService.SyncOfflineReadings(c.Request().Context(), getClaims(c), batch)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, res)
	})

	api.GET("/tabwater/invoices", func(c echo.Context) error {
		var periodID *int64
		if rawP := c.QueryParam("period_id"); rawP != "" {
			if parsed, err := strconv.ParseInt(rawP, 10, 64); err == nil {
				periodID = &parsed
			}
		}
		items, err := cfg.WaterService.ListInvoices(c.Request().Context(), getClaims(c), c.QueryParam("status"), periodID)
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, map[string]any{"items": items})
	})

	api.POST("/tabwater/invoices/:id/pay", func(c echo.Context) error {
		invID, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil || invID <= 0 {
			return writeProblem(c, http.StatusBadRequest, "Bad Request", "invalid invoice id")
		}
		var body struct {
			PaymentMethod string `json:"payment_method"`
		}
		_ = c.Bind(&body)
		inv, err := cfg.WaterService.PayInvoice(c.Request().Context(), getClaims(c), domain.PayWaterInvoiceCommand{
			InvoiceID:     invID,
			CashierID:     1,
			PaymentMethod: body.PaymentMethod,
		})
		if err != nil {
			return mapDomainError(c, err)
		}
		return c.JSON(http.StatusOK, inv)
	})

	return e
}

func authMiddleware(cfg ServerConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := strings.TrimSpace(c.Request().Header.Get(echo.HeaderAuthorization))
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				return writeProblem(c, http.StatusUnauthorized, "Unauthorized", "missing bearer token")
			}
			rawToken := strings.TrimSpace(authHeader[7:])
			if rawToken == "" {
				return writeProblem(c, http.StatusUnauthorized, "Unauthorized", "empty bearer token")
			}

			var claims domain.Claims
			var err error

			if cfg.AllowDemoTokens && strings.HasPrefix(rawToken, "demo-jwt-") {
				orgID := int64(1)
				claims = domain.Claims{
					JTI:       rawToken,
					Subject:   "demo-staff-1",
					Username:  "somchai_staff",
					Roles:     []string{domain.RoleAdmin, domain.RoleTabwaterStaff, domain.RoleFinanceStaff},
					OrgID:     &orgID,
					ExpiresAt: time.Now().Add(2 * time.Hour),
				}
			} else if cfg.Verifier != nil {
				claims, err = cfg.Verifier.VerifyAccessToken(c.Request().Context(), rawToken)
				if err != nil {
					return writeProblem(c, http.StatusUnauthorized, "Unauthorized", err.Error())
				}
			} else {
				return writeProblem(c, http.StatusUnauthorized, "Unauthorized", "token verifier not configured")
			}

			if cfg.Blacklist != nil && claims.JTI != "" {
				revoked, err := cfg.Blacklist.IsRevoked(c.Request().Context(), claims.JTI)
				if err != nil || revoked {
					return writeProblem(c, http.StatusUnauthorized, "Unauthorized", "token has been logged out and blacklisted")
				}
			}

			c.Set(string(claimsKey), claims)
			return next(c)
		}
	}
}

func getClaims(c echo.Context) domain.Claims {
	if val := c.Get(string(claimsKey)); val != nil {
		if cl, ok := val.(domain.Claims); ok {
			return cl
		}
	}
	return domain.Claims{}
}
