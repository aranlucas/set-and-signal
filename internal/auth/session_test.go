package auth

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func newTestSessions(t *testing.T) *Sessions {
	t.Helper()
	s, err := NewSessions(t.TempDir(), 90)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestNewSessionsCreatesAndReusesSecret(t *testing.T) {
	dir := t.TempDir()
	s1, err := NewSessions(dir, 90)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(dir, "secret"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("secret perms = %v, want 0600", info.Mode().Perm())
	}
	if len(s1.Secret) != 64 { // 32 random bytes as hex
		t.Fatalf("secret length = %d, want 64 hex chars", len(s1.Secret))
	}
	s2, err := NewSessions(dir, 90)
	if err != nil {
		t.Fatal(err)
	}
	if string(s1.Secret) != string(s2.Secret) {
		t.Fatal("existing secret must be reused, not regenerated")
	}
}

// A 0-byte secret file must be regenerated, not trusted: an empty HMAC key
// makes every cookie forgeable.
func TestEmptySecretFileRegenerated(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "secret")
	if err := os.WriteFile(path, []byte("  \n"), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := NewSessions(dir, 90)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Secret) != 64 { // 32 random bytes as hex
		t.Fatalf("secret = %q, want regenerated 64-char hex", s.Secret)
	}
	persisted, err := os.ReadFile(path)
	if err != nil || string(persisted) != string(s.Secret) {
		t.Fatalf("secret file not rewritten: %q, %v", persisted, err)
	}

	lookup := func(string) (sv int, disabled bool) { return 0, false }
	// A cookie signed with an empty key must fail against the new secret...
	forged, _ := (&Sessions{Days: 90}).Make("u1", 0)
	if _, ok := s.Read(forged, lookup); ok {
		t.Fatal("cookie signed with an empty key verified")
	}
	// ...while the regenerated secret round-trips.
	val, maxAge := s.Make("u1", 0)
	uid, ok := s.Read(val, lookup)
	if !ok || uid != "u1" || maxAge <= 0 {
		t.Fatalf("regenerated secret roundtrip = %q %v %d", uid, ok, maxAge)
	}
}

func TestMakeReadRoundtrip(t *testing.T) {
	s := newTestSessions(t)
	cookie, maxAge := s.Make("alice", 3)
	if maxAge != 90*86400 {
		t.Fatalf("maxAge = %d, want %d", maxAge, 90*86400)
	}
	got, ok := s.Read(cookie, func(uid string) (int, bool) {
		if uid != "alice" {
			t.Fatalf("lookup got uid %q", uid)
		}
		return 3, false
	})
	if !ok || got != "alice" {
		t.Fatalf("Read = (%q, %v), want (alice, true)", got, ok)
	}
}

func TestTamperedMACRejected(t *testing.T) {
	s := newTestSessions(t)
	cookie, _ := s.Make("alice", 0)
	bad := cookie[:len(cookie)-2] + "xx"
	if _, ok := s.Read(bad, func(string) (int, bool) { return 0, false }); ok {
		t.Fatal("tampered MAC must be rejected")
	}
	// A payload signed with a different secret must also fail.
	other := &Sessions{Secret: []byte("another-secret"), Days: 90}
	foreign, _ := other.Make("alice", 0)
	if _, ok := s.Read(foreign, func(string) (int, bool) { return 0, false }); ok {
		t.Fatal("foreign-secret cookie must be rejected")
	}
}

func TestExpiredRejected(t *testing.T) {
	s := newTestSessions(t)
	stale := s.sign(fmt.Sprintf("alice:%d:0", time.Now().Add(-time.Minute).UnixMilli()))
	if _, ok := s.Read(stale, func(string) (int, bool) { return 0, false }); ok {
		t.Fatal("expired session must be rejected")
	}
}

func TestSVMismatchRejected(t *testing.T) {
	s := newTestSessions(t)
	cookie, _ := s.Make("alice", 1)
	if _, ok := s.Read(cookie, func(string) (int, bool) { return 2, false }); ok {
		t.Fatal("sv mismatch must be rejected")
	}
	if _, ok := s.Read(cookie, func(string) (int, bool) { return 1, false }); !ok {
		t.Fatal("matching sv must be accepted")
	}
}

func TestLegacyTwoFieldPayloadIsVersionZero(t *testing.T) {
	s := newTestSessions(t)
	// Pre-versioning cookie: `<uid>:<future-exp>` with no third field.
	legacy := s.sign(fmt.Sprintf("bob:%d", time.Now().Add(time.Hour).UnixMilli()))
	if _, ok := s.Read(legacy, func(string) (int, bool) { return 0, false }); !ok {
		t.Fatal("legacy 2-field cookie with sv-0 user must be accepted")
	}
	// Same legacy shape against a bumped (sv>0) account is refused.
	if _, ok := s.Read(legacy, func(string) (int, bool) { return 5, false }); ok {
		t.Fatal("legacy cookie must read as version 0 and mismatch sv 5")
	}
}

func TestDisabledAndUnknownUsersRejected(t *testing.T) {
	s := newTestSessions(t)
	cookie, _ := s.Make("mallory", 0)
	if _, ok := s.Read(cookie, func(string) (int, bool) { return 0, true }); ok {
		t.Fatal("disabled user must be rejected")
	}
	unknown := s.sign(fmt.Sprintf("ghost:%d:0", time.Now().Add(time.Hour).UnixMilli()))
	if _, ok := s.Read(unknown, func(string) (int, bool) { return 0, true }); ok {
		t.Fatal("unknown user (reported disabled) must be rejected")
	}
}

func TestMalformedPayloadsRejected(t *testing.T) {
	s := newTestSessions(t)
	lookup := func(string) (int, bool) { return 0, false }
	for _, tok := range []string{
		"", "nosig", ".", "a.", ".b",
		s.sign(":123:0"), // empty uid
	} {
		if uid, ok := s.Read(tok, lookup); ok {
			t.Fatalf("Read(%q) accepted as %q, want rejection", tok, uid)
		}
	}
	// Upstream quirk kept faithfully: a signed payload whose exp field isn't
	// numeric coerces to NaN, fails `+exp < Date.now()`, and falls through to
	// the version check — so it verifies for an sv-0 user.
	quirk := s.sign("a:junk")
	if uid, ok := s.Read(quirk, lookup); !ok || uid != "a" {
		t.Fatalf(`Read(%q) = (%q,%v), want ("a",true) per upstream NaN-exp behavior`, quirk, uid, ok)
	}
}
