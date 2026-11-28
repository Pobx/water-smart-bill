package application

import (
	"errors"
	"net/url"
	"strconv"
	"strings"
	"time"
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
	UserID    *int64
	ExpiresAt time.Time
}

// ResolvedUserID extracts the numeric application user ID from claims (explicit user_id claim,
// numeric subject, or demo-user-<id> subject format).
func (c Claims) ResolvedUserID() (int64, bool) {
	if c.UserID != nil && *c.UserID > 0 {
		return *c.UserID, true
	}
	sub := strings.TrimSpace(c.Subject)
	if id, err := strconv.ParseInt(sub, 10, 64); err == nil && id > 0 {
		return id, true
	}
	if strings.HasPrefix(sub, "demo-user-") {
		if id, err := strconv.ParseInt(strings.TrimPrefix(sub, "demo-user-"), 10, 64); err == nil && id > 0 {
			return id, true
		}
	}
	return 0, false
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

// MeterRoute represents a meter-reading route assigned to an organization and optionally a staff member.
type MeterRoute struct {
	ID      int64  `json:"id"`
	OrgID   int64  `json:"org_id"`
	Name    string `json:"name"`
	StaffID *int64 `json:"staff_id"`
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

// GenerateDefaultAvatarSVG generates a clean SVG avatar when a homeowner has no uploaded photo.
func GenerateDefaultAvatarSVG(name string) string {
	_ = name
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Default Avatar">
  <defs>
    <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="60" fill="url(#waterGrad)" />
  <!-- Modern user avatar silhouette -->
  <circle cx="60" cy="46" r="20" fill="#ffffff" opacity="0.95" />
  <path d="M26,104 C26,82 40,74 60,74 C80,74 94,82 94,104 Z" fill="#ffffff" opacity="0.95" />
</svg>`
}
