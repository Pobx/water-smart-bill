package keycloak_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jws"
	"github.com/lestrrat-go/jwx/v2/jwt"

	"github.com/pobx/water-smart-bill/backend-go/internal/adapter/out/keycloak"
)

func TestKeycloakVerifierExtractsClaimsAndJTI(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	pubJWK, err := jwk.FromRaw(priv.PublicKey)
	if err != nil {
		t.Fatalf("from raw pubkey: %v", err)
	}
	_ = pubJWK.Set(jwk.KeyIDKey, "test-kid-1")
	_ = pubJWK.Set(jwk.AlgorithmKey, jwa.RS256)
	set := jwk.NewSet()
	_ = set.AddKey(pubJWK)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(set)
	}))
	defer srv.Close()

	tok, err := jwt.NewBuilder().
		JwtID("jti-xyz-999").
		Subject("user-uuid-1").
		Issuer("http://localhost:8081/realms/water").
		Audience([]string{"water-api"}).
		Expiration(time.Now().Add(15 * time.Minute)).
		Claim("preferred_username", "somchai_admin").
		Claim("org_id", 1).
		Claim("realm_access", map[string]any{"roles": []string{"admin", "tabwater_staff"}}).
		Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}

	hdrs := jws.NewHeaders()
	_ = hdrs.Set(jws.KeyIDKey, "test-kid-1")
	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256, priv, jws.WithProtectedHeaders(hdrs)))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	verifier := keycloak.NewVerifier(keycloak.Config{
		Issuer:   "http://localhost:8081/realms/water",
		JWKSURL:  srv.URL,
		Audience: "water-api",
	})

	claims, err := verifier.VerifyAccessToken(context.Background(), string(signed))
	if err != nil {
		t.Fatalf("verify token failed: %v", err)
	}
	if claims.JTI != "jti-xyz-999" || claims.Username != "somchai_admin" || claims.OrgID == nil || *claims.OrgID != 1 {
		t.Fatalf("unexpected claims: %+v", claims)
	}
	if !claims.HasAnyRole("tabwater_staff") {
		t.Fatalf("expected tabwater_staff role")
	}
}
