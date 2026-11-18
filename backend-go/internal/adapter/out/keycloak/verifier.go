package keycloak

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jws"
	"github.com/lestrrat-go/jwx/v2/jwt"

	"github.com/pobx/water-smart-bill/backend-go/internal/domain"
)

const (
	defaultTimeout  = 5 * time.Second
	defaultCooldown = 10 * time.Second
	clockSkew       = 5 * time.Second
)

type Config struct {
	Issuer          string
	JWKSURL         string
	Audience        string
	Timeout         time.Duration
	RefreshCooldown time.Duration
	HTTPClient      *http.Client
}

type Verifier struct {
	cfg       Config
	client    *http.Client
	mu        sync.Mutex
	keys      map[string]jwk.Key
	lastFetch time.Time
}

func NewVerifier(cfg Config) *Verifier {
	if cfg.Timeout <= 0 {
		cfg.Timeout = defaultTimeout
	}
	if cfg.RefreshCooldown <= 0 {
		cfg.RefreshCooldown = defaultCooldown
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{}
	}
	return &Verifier{cfg: cfg, client: client, keys: map[string]jwk.Key{}}
}

func unauthorized(format string, args ...any) error {
	return fmt.Errorf("%w: %s", domain.ErrUnauthorized, fmt.Sprintf(format, args...))
}

func (v *Verifier) VerifyAccessToken(ctx context.Context, rawToken string) (domain.Claims, error) {
	msg, err := jws.Parse([]byte(rawToken))
	if err != nil || len(msg.Signatures()) != 1 {
		return domain.Claims{}, unauthorized("malformed token")
	}
	hdr := msg.Signatures()[0].ProtectedHeaders()
	if hdr.Algorithm() != jwa.RS256 {
		return domain.Claims{}, unauthorized("unsupported algorithm %q", hdr.Algorithm())
	}
	key, err := v.keyFor(ctx, hdr.KeyID())
	if err != nil {
		return domain.Claims{}, err
	}

	opts := []jwt.ParseOption{
		jwt.WithKey(jwa.RS256, key),
		jwt.WithValidate(true),
		jwt.WithAcceptableSkew(clockSkew),
	}
	if v.cfg.Issuer != "" {
		opts = append(opts, jwt.WithIssuer(v.cfg.Issuer))
	}
	if v.cfg.Audience != "" {
		opts = append(opts, jwt.WithAudience(v.cfg.Audience))
	}

	tok, err := jwt.Parse([]byte(rawToken), opts...)
	if err != nil {
		return domain.Claims{}, unauthorized("invalid token: %v", err)
	}
	if tok.Expiration().IsZero() {
		return domain.Claims{}, unauthorized("token has no exp")
	}
	return toClaims(tok, rawToken)
}

func toClaims(tok jwt.Token, rawToken string) (domain.Claims, error) {
	jti := tok.JwtID()
	if jti == "" {
		sum := sha256.Sum256([]byte(rawToken))
		jti = hex.EncodeToString(sum[:16])
	}
	c := domain.Claims{
		JTI:       jti,
		Subject:   tok.Subject(),
		ExpiresAt: tok.Expiration(),
	}
	if u, ok := tok.Get("preferred_username"); ok {
		c.Username, _ = u.(string)
	}
	if ra, ok := tok.Get("realm_access"); ok {
		if m, ok := ra.(map[string]any); ok {
			if rs, ok := m["roles"].([]any); ok {
				for _, r := range rs {
					if s, ok := r.(string); ok {
						c.Roles = append(c.Roles, s)
					}
				}
			}
		}
	}
	if raw, ok := tok.Get("org_id"); ok && raw != nil {
		id, err := parseOrgID(raw)
		if err != nil {
			return domain.Claims{}, unauthorized("invalid org_id claim")
		}
		c.OrgID = &id
	}
	return c, nil
}

func parseOrgID(raw any) (int64, error) {
	switch x := raw.(type) {
	case float64:
		return int64(x), nil
	case json.Number:
		return x.Int64()
	case string:
		return strconv.ParseInt(x, 10, 64)
	default:
		return 0, fmt.Errorf("unsupported org_id type %T", raw)
	}
}

func (v *Verifier) keyFor(ctx context.Context, kid string) (jwk.Key, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if k, ok := v.keys[kid]; ok {
		return k, nil
	}
	if !v.lastFetch.IsZero() && time.Since(v.lastFetch) < v.cfg.RefreshCooldown {
		return nil, unauthorized("unknown signing key")
	}
	if err := v.fetchLocked(ctx); err != nil {
		return nil, err
	}
	k, ok := v.keys[kid]
	if !ok {
		return nil, unauthorized("unknown signing key")
	}
	return k, nil
}

func (v *Verifier) fetchLocked(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, v.cfg.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.cfg.JWKSURL, nil)
	if err != nil {
		return unauthorized("jwks request: %v", err)
	}
	v.lastFetch = time.Now()
	resp, err := v.client.Do(req)
	if err != nil {
		return unauthorized("jwks fetch: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return unauthorized("jwks fetch: status %d", resp.StatusCode)
	}
	set, err := jwk.ParseReader(resp.Body)
	if err != nil {
		return unauthorized("jwks parse: %v", err)
	}
	keys := make(map[string]jwk.Key, set.Len())
	for it := set.Keys(ctx); it.Next(ctx); {
		k, ok := it.Pair().Value.(jwk.Key)
		if !ok {
			continue
		}
		keys[k.KeyID()] = k
	}
	v.keys = keys
	return nil
}
