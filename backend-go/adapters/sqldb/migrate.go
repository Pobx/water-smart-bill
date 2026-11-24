package sqldb

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type migrationFile struct {
	Name     string
	SQL      string
	Checksum string
}

// listUpMigrations returns every *.up.sql in dir, sorted by file name, with checksums.
func listUpMigrations(dir string) ([]migrationFile, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)
	out := make([]migrationFile, 0, len(paths))
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		// Normalize CRLF so Windows checkouts do not look like schema changes.
		content := strings.ReplaceAll(string(b), "\r\n", "\n")
		sum := sha256.Sum256([]byte(content))
		out = append(out, migrationFile{Name: filepath.Base(p), SQL: content, Checksum: hex.EncodeToString(sum[:])})
	}
	return out, nil
}

// runMigrations applies migrations (schema + seed data) only when needed:
//   - empty database            -> apply everything (schema + seed)
//   - file changed (checksum)   -> re-apply that file (migrations are idempotent)
//   - nothing changed           -> do nothing
func (s *Store) runMigrations(ctx context.Context, dir string) error {
	files, err := listUpMigrations(dir)
	if err != nil {
		return err
	}
	conn, err := s.db.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(727001)`); err != nil {
		return err
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock(727001)`) //nolint:errcheck

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		name TEXT PRIMARY KEY,
		checksum TEXT NOT NULL,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	for _, f := range files {
		var current string
		err := conn.QueryRow(ctx, `SELECT checksum FROM schema_migrations WHERE name=$1`, f.Name).Scan(&current)
		if err == nil && current == f.Checksum {
			log.Printf("INFO: migration %s unchanged, skipped", f.Name)
			continue
		}
		log.Printf("INFO: applying migration %s", f.Name)
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, f.SQL); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("exec %s: %w", f.Name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name, checksum) VALUES ($1,$2)
			ON CONFLICT (name) DO UPDATE SET checksum=EXCLUDED.checksum, applied_at=now()`, f.Name, f.Checksum); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
