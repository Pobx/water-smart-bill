package domain

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrBadRequest   = errors.New("bad request")
	ErrConflict     = errors.New("conflict")
)

const (
	RoleSuperAdmin    = "super_admin"
	RoleAdmin         = "admin"
	RoleFinanceStaff  = "finance_staff"
	RoleTabwaterStaff = "tabwater_staff"
	RoleUser          = "user"
)

type Claims struct {
	JTI       string
	Subject   string
	Username  string
	Roles     []string
	OrgID     *int64
	ExpiresAt time.Time
}

func (c Claims) HasAnyRole(roles ...string) bool {
	if len(roles) == 0 {
		return true
	}
	set := make(map[string]struct{}, len(c.Roles))
	for _, r := range c.Roles {
		set[r] = struct{}{}
	}
	for _, r := range roles {
		if _, ok := set[r]; ok {
			return true
		}
	}
	return false
}

// ResolveOrgScope enforces multi-tenant isolation.
func (c Claims) ResolveOrgScope(requestedOrgID *int64) (*int64, error) {
	if c.HasAnyRole(RoleSuperAdmin) {
		return requestedOrgID, nil
	}
	if c.OrgID == nil {
		return nil, ErrForbidden
	}
	if requestedOrgID != nil && *requestedOrgID != *c.OrgID {
		return nil, ErrForbidden
	}
	return c.OrgID, nil
}

type TokenVerifier interface {
	VerifyAccessToken(ctx context.Context, rawToken string) (Claims, error)
}

type TokenBlacklist interface {
	RevokeToken(ctx context.Context, jti string, expiresAt time.Time) error
	IsRevoked(ctx context.Context, jti string) (bool, error)
}

// ResolveAvatarURL returns the uploaded avatar URL if present, or falls back to the automatic Default Avatar endpoint.
func ResolveAvatarURL(imageURL, firstName, lastName string) string {
	trimmed := strings.TrimSpace(imageURL)
	if trimmed != "" {
		return trimmed
	}
	fullName := strings.TrimSpace(firstName + " " + lastName)
	if fullName == "" {
		fullName = "เจ้าของบ้าน"
	}
	return "/api/v1/avatars/default?name=" + url.QueryEscape(fullName)
}

// GenerateDefaultAvatarSVG generates a clean SVG avatar with initials when a homeowner has no uploaded photo.
func GenerateDefaultAvatarSVG(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		trimmed = "U"
	}
	parts := strings.Fields(trimmed)
	var initials string
	if len(parts) >= 2 {
		r1, _ := utf8.DecodeRuneInString(parts[0])
		r2, _ := utf8.DecodeRuneInString(parts[1])
		initials = string(r1) + string(r2)
	} else {
		r1, _ := utf8.DecodeRuneInString(parts[0])
		initials = string(r1)
	}
	escaped := html.EscapeString(strings.ToUpper(initials))
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Default Avatar">
  <defs>
    <linearGradient id="waterGrad" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
      <stop offset="0%%" stop-color="#0284c7" />
      <stop offset="100%%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="60" fill="url(#waterGrad)" />
  <text x="50%%" y="54%%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Inter, Sarabun, sans-serif" font-size="42" font-weight="700">%s</text>
</svg>`, escaped)
}
