package rest

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/pobx/water-smart-bill/backend-go/adapters/web/rest/handler"
	"github.com/pobx/water-smart-bill/backend-go/application"
	"github.com/pobx/water-smart-bill/backend-go/application/ports"
)

type ServerConfig struct {
	AppEnv          string
	Verifier        ports.TokenVerifierInterface
	Blacklist       ports.TokenBlacklistInterface
	WaterService    ports.WaterBillServiceInterface
	UploadDir       string
	OpenAPISpec     []byte
	AllowDemoTokens bool
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

	restHandler := handler.NewWaterBillRestHandler(cfg.WaterService, cfg.Blacklist, uploadDir)

	// Public Endpoints: Default Avatar SVG & LINE LIFF Resident Portal
	e.GET("/api/v1/avatars/default", restHandler.DefaultAvatar)
	e.GET("/api/v1/liff/bills", restHandler.GetLiffBills)
	e.POST("/api/v1/liff/link", restHandler.LinkLiffAccount)

	// Protected API Group (Keycloak JWT + Redis Blacklist Check)
	api := e.Group("/api/v1", authMiddleware(cfg))

	api.POST("/auth/logout", restHandler.Logout)
	api.GET("/me", restHandler.GetMe)

	// Master Data: SAO (อบต.), Tambons, Villages (Zones/Subzones), Homeowners & Avatars
	rolesAdminOnly := []string{application.RoleAdmin, application.RoleSuperAdmin}
	rolesStaffOrAdmin := []string{application.RoleTabwaterStaff, application.RoleAdmin, application.RoleSuperAdmin}
	rolesFinanceOrAdmin := []string{application.RoleFinanceStaff, application.RoleAdmin, application.RoleSuperAdmin}

	api.GET("/organizations", restHandler.GetOrganization)
	api.POST("/organizations", restHandler.UpsertOrganization, RequireRoles(rolesAdminOnly))
	api.GET("/locations/tambons", restHandler.ListTambons)
	api.GET("/zones", restHandler.ListZones)
	api.POST("/zones", restHandler.CreateZone, RequireRoles(rolesAdminOnly))
	api.GET("/users", restHandler.ListHomeowners)
	api.POST("/users", restHandler.CreateHomeowner, RequireRoles(rolesStaffOrAdmin))
	api.POST("/users/:id/avatar", restHandler.UploadHomeownerAvatar, RequireRoles(rolesStaffOrAdmin))

	// Tariffs, Periods, Meters & Readings
	api.GET("/tabwater/rate-configs", restHandler.GetActiveRateConfig)
	api.POST("/tabwater/rate-configs", restHandler.SaveRateConfig, RequireRoles(rolesAdminOnly))
	api.GET("/tabwater/periods", restHandler.ListPeriods)
	api.POST("/tabwater/periods", restHandler.CreatePeriod, RequireRoles(rolesAdminOnly))
	api.GET("/tabwater/meters", restHandler.ListMeters)
	api.POST("/tabwater/meters", restHandler.CreateMeter, RequireRoles(rolesStaffOrAdmin))
	api.GET("/tabwater/offline-bundle", restHandler.GetOfflineBundle, RequireRoles(rolesStaffOrAdmin))
	api.POST("/tabwater/ocr/meter-read", restHandler.ParseMeterOCR, RequireRoles(rolesStaffOrAdmin))
	api.POST("/tabwater/readings", restHandler.RecordMeterReading, RequireRoles(rolesStaffOrAdmin))
	api.POST("/tabwater/readings/sync", restHandler.SyncOfflineReadings, RequireRoles(rolesStaffOrAdmin))
	api.GET("/tabwater/invoices", restHandler.ListInvoices)
	api.POST("/tabwater/invoices/:id/pay", restHandler.PayInvoice, RequireRoles(rolesFinanceOrAdmin))
	api.GET("/tabwater/reports/collections", restHandler.GetCollectionReport, RequireRoles(rolesFinanceOrAdmin))
	api.GET("/water-bills/reports/collections", restHandler.GetCollectionReport, RequireRoles(rolesFinanceOrAdmin))

	return e
}

// RequireRoles returns Echo middleware that enforces Role-Based Access Control (RBAC).
// It accepts exactly 1 parameter (allowedRoles []string) containing multiple allowed role values.
func RequireRoles(allowedRoles []string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, ok := c.Get(handler.ClaimsContextKey).(application.Claims)
			if !ok {
				return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", "missing authentication claims")
			}
			if len(allowedRoles) > 0 && !claims.HasAnyRole(allowedRoles...) {
				return handler.WriteProblem(c, http.StatusForbidden, "Forbidden", "insufficient role permissions")
			}
			return next(c)
		}
	}
}

func authMiddleware(cfg ServerConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := strings.TrimSpace(c.Request().Header.Get(echo.HeaderAuthorization))
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", "missing bearer token")
			}
			rawToken := strings.TrimSpace(authHeader[7:])
			if rawToken == "" {
				return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", "empty bearer token")
			}

			var claims application.Claims
			var err error

			if cfg.AllowDemoTokens && strings.HasPrefix(rawToken, "demo-jwt-") {
				claims = buildDemoClaims(rawToken)
			} else if cfg.Verifier != nil {
				claims, err = cfg.Verifier.VerifyAccessToken(c.Request().Context(), rawToken)
				if err != nil {
					return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", err.Error())
				}
			} else {
				return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", "token verifier not configured")
			}

			if cfg.Blacklist != nil && claims.JTI != "" {
				revoked, err := cfg.Blacklist.IsRevoked(c.Request().Context(), claims.JTI)
				if err != nil || revoked {
					return handler.WriteProblem(c, http.StatusUnauthorized, "Unauthorized", "session has been revoked or logged out")
				}
			}

			c.Set(handler.ClaimsContextKey, claims)
			return next(c)
		}
	}
}

func buildDemoClaims(rawToken string) application.Claims {
	orgID := int64(1)
	base := application.Claims{
		JTI:       rawToken,
		OrgID:     &orgID,
		ExpiresAt: time.Now().Add(2 * time.Hour),
	}
	switch {
	case strings.HasPrefix(rawToken, "demo-jwt-role-admin-"):
		base.Subject = "demo-admin-1"
		base.Username = "admin_hsg"
		base.Roles = []string{application.RoleAdmin}
	case strings.HasPrefix(rawToken, "demo-jwt-role-tabwater_staff-"):
		base.Subject = "demo-staff-1"
		base.Username = "somchai_staff"
		base.Roles = []string{application.RoleTabwaterStaff}
	case strings.HasPrefix(rawToken, "demo-jwt-role-finance_staff-"):
		base.Subject = "demo-finance-1"
		base.Username = "finance_naree"
		base.Roles = []string{application.RoleFinanceStaff}
	case strings.HasPrefix(rawToken, "demo-jwt-role-user-"):
		base.Subject = "demo-user-1"
		base.Username = "resident_sommai"
		base.Roles = []string{application.RoleUser}
	default:
		base.Subject = "demo-staff-1"
		base.Username = "somchai_staff"
		base.Roles = []string{application.RoleAdmin, application.RoleTabwaterStaff, application.RoleFinanceStaff}
	}
	return base
}
