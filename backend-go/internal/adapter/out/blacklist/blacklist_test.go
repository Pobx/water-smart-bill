package blacklist_test

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/pobx/water-smart-bill/backend-go/internal/adapter/out/blacklist"
)

func TestMemoryAndRedisTokenBlacklist(t *testing.T) {
	ctx := context.Background()
	store := blacklist.NewStore("") // In-memory fallback when no redis addr or in unit test

	revoked, err := store.IsRevoked(ctx, "jti-12345")
	if err != nil || revoked {
		t.Fatalf("expected token not revoked initially, got revoked=%v err=%v", revoked, err)
	}

	err = store.RevokeToken(ctx, "jti-12345", time.Now().Add(15*time.Minute))
	if err != nil {
		t.Fatalf("unexpected error revoking token: %v", err)
	}

	revoked, err = store.IsRevoked(ctx, "jti-12345")
	if err != nil || !revoked {
		t.Fatalf("expected token to be revoked after logout, got revoked=%v err=%v", revoked, err)
	}
}

func TestRedisProtocolBlacklistStore(t *testing.T) {
	// Spin up a lightweight mock Redis RESP server on localhost
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()

	keys := map[string]string{}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				buf := make([]byte, 4096)
				for {
					n, err := c.Read(buf)
					if err != nil {
						return
					}
					req := string(buf[:n])
					if strings.Contains(req, "SETEX") {
						keys["revoked"] = "1"
						_, _ = c.Write([]byte("+OK\r\n"))
					} else if strings.Contains(req, "EXISTS") {
						if keys["revoked"] == "1" {
							_, _ = c.Write([]byte(":1\r\n"))
						} else {
							_, _ = c.Write([]byte(":0\r\n"))
						}
					} else {
						_, _ = c.Write([]byte("+OK\r\n"))
					}
				}
			}(conn)
		}
	}()

	ctx := context.Background()
	store := blacklist.NewStore(ln.Addr().String())

	revoked, err := store.IsRevoked(ctx, "jti-redis-1")
	if err != nil || revoked {
		t.Fatalf("expected false before revoke, got %v, err=%v", revoked, err)
	}

	if err := store.RevokeToken(ctx, "jti-redis-1", time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("revoke on redis: %v", err)
	}

	revoked, err = store.IsRevoked(ctx, "jti-redis-1")
	if err != nil || !revoked {
		t.Fatalf("expected true after revoke on redis, got %v, err=%v", revoked, err)
	}
}
