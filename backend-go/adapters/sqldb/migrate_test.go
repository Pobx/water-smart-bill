package sqldb

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListUpMigrationsSortedAndCRLFStable(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "000002_b.up.sql"), []byte("SELECT 2;\r\n"), 0o644)
	os.WriteFile(filepath.Join(dir, "000001_a.up.sql"), []byte("SELECT 1;\n"), 0o644)
	os.WriteFile(filepath.Join(dir, "000001_a.down.sql"), []byte("x"), 0o644)
	got, err := listUpMigrations(dir)
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v err %v", got, err)
	}
	if got[0].Name != "000001_a.up.sql" || got[1].Name != "000002_b.up.sql" {
		t.Fatalf("bad order: %v", got)
	}
	os.WriteFile(filepath.Join(dir, "000002_b.up.sql"), []byte("SELECT 2;\n"), 0o644)
	again, _ := listUpMigrations(dir)
	if again[1].Checksum != got[1].Checksum {
		t.Fatal("CRLF must not change checksum")
	}
}
