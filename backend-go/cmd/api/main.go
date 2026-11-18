package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/adapters/blacklist"
	"github.com/pobx/water-smart-bill/backend-go/adapters/keycloak"
	"github.com/pobx/water-smart-bill/backend-go/adapters/memory"
	"github.com/pobx/water-smart-bill/backend-go/adapters/sqldb"
	"github.com/pobx/water-smart-bill/backend-go/adapters/web/rest"
	"github.com/pobx/water-smart-bill/backend-go/application/ports"
	"github.com/pobx/water-smart-bill/backend-go/application/services"
)

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func main() {
	httpAddr := getenv("HTTP_ADDR", ":8080")
	appEnv := getenv("APP_ENV", "demo")
	dbURL := os.Getenv("DATABASE_URL")
	redisAddr := os.Getenv("REDIS_ADDR")
	migrationsDir := getenv("MIGRATIONS_DIR", "db/migrations")
	uploadDir := getenv("UPLOAD_DIR", "/tmp/water-smart-bill-uploads")
	openAPIPath := getenv("OPENAPI_PATH", "api/openapi.yaml")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	var repo ports.WaterBillRepositoryInterface
	if strings.TrimSpace(dbURL) != "" {
		pgStore, err := sqldb.NewStore(ctx, dbURL, migrationsDir)
		if err != nil {
			log.Printf("WARN: PostgreSQL connection failed (%v), falling back to seeded memory store", err)
			repo = memory.NewStore()
		} else {
			defer pgStore.Close()
			repo = pgStore
			log.Printf("INFO: Connected to PostgreSQL and applied migrations")
		}
	} else {
		log.Printf("INFO: No DATABASE_URL provided, using seeded in-memory store for demo")
		repo = memory.NewStore()
	}

	verifier := keycloak.NewVerifier(keycloak.Config{
		Issuer:   os.Getenv("KEYCLOAK_ISSUER"),
		JWKSURL:  getenv("KEYCLOAK_JWKS_URL", "http://keycloak:8080/realms/water-smart-bill/protocol/openid-connect/certs"),
		Audience: os.Getenv("KEYCLOAK_AUDIENCE"),
	})

	bl := blacklist.NewStore(redisAddr)
	svc := services.NewWaterBillService(repo)
	specBytes, _ := os.ReadFile(openAPIPath)

	srv := rest.NewServer(rest.ServerConfig{
		AppEnv:          appEnv,
		Verifier:        verifier,
		Blacklist:       bl,
		WaterService:    svc,
		UploadDir:       uploadDir,
		OpenAPISpec:     specBytes,
		AllowDemoTokens: !strings.EqualFold(appEnv, "production"),
	})

	log.Printf("Starting Water Smart Bill API on %s (env=%s)", httpAddr, appEnv)
	if err := srv.Start(httpAddr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
