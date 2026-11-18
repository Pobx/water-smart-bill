package blacklist

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

// Store implements domain.TokenBlacklist backed by Redis (via native RESP TCP protocol)
// with an automatic thread-safe in-memory cache/fallback.
type Store struct {
	redisAddr string
	mu        sync.RWMutex
	mem       map[string]time.Time
}

func NewStore(redisAddr string) *Store {
	return &Store{
		redisAddr: strings.TrimSpace(redisAddr),
		mem:       make(map[string]time.Time),
	}
}

func (s *Store) RevokeToken(ctx context.Context, jti string, expiresAt time.Time) error {
	trimmed := strings.TrimSpace(jti)
	if trimmed == "" {
		return nil
	}
	ttl := time.Until(expiresAt)
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	seconds := int(ttl.Seconds())
	if seconds <= 0 {
		seconds = 60
	}

	s.mu.Lock()
	s.mem[trimmed] = time.Now().Add(time.Duration(seconds) * time.Second)
	s.mu.Unlock()

	if s.redisAddr != "" {
		key := "blacklist:jwt:" + trimmed
		cmd := fmt.Sprintf("*4\r\n$5\r\nSETEX\r\n$%d\r\n%s\r\n$%d\r\n%d\r\n$1\r\n1\r\n",
			len(key), key, len(fmt.Sprintf("%d", seconds)), seconds)
		_, _ = s.sendRedisCmd(ctx, cmd)
	}
	return nil
}

func (s *Store) IsRevoked(ctx context.Context, jti string) (bool, error) {
	trimmed := strings.TrimSpace(jti)
	if trimmed == "" {
		return false, nil
	}

	if s.redisAddr != "" {
		key := "blacklist:jwt:" + trimmed
		cmd := fmt.Sprintf("*2\r\n$6\r\nEXISTS\r\n$%d\r\n%s\r\n", len(key), key)
		if resp, err := s.sendRedisCmd(ctx, cmd); err == nil {
			if strings.HasPrefix(resp, ":1") {
				return true, nil
			}
		}
	}

	s.mu.RLock()
	exp, exists := s.mem[trimmed]
	s.mu.RUnlock()
	if !exists {
		return false, nil
	}
	if time.Now().After(exp) {
		s.mu.Lock()
		delete(s.mem, trimmed)
		s.mu.Unlock()
		return false, nil
	}
	return true, nil
}

func (s *Store) sendRedisCmd(ctx context.Context, rawCmd string) (string, error) {
	d := net.Dialer{Timeout: 1500 * time.Millisecond}
	conn, err := d.DialContext(ctx, "tcp", s.redisAddr)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(1500 * time.Millisecond))
	if _, err := conn.Write([]byte(rawCmd)); err != nil {
		return "", err
	}
	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(line), nil
}
