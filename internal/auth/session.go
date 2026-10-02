// Package auth implements passkey authentication and signed session cookies.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Sessions signs and verifies `gymsid` cookie values. Secret is the raw
// contents of $DATA_DIR/secret.
type Sessions struct {
	Secret []byte
	Days   int
}

// NewSessions loads or creates the hex secret file at dataDir/secret
// (mirroring server.js lines 38–40: 32 random bytes as hex, mode 0600).
func NewSessions(dataDir string, days int) (*Sessions, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("auth: create data dir: %w", err)
	}
	path := filepath.Join(dataDir, "secret")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err == nil {
		raw := make([]byte, 32)
		if _, err := rand.Read(raw); err != nil {
			_ = f.Close()
			return nil, fmt.Errorf("auth: generate secret: %w", err)
		}
		if _, err := f.WriteString(hex.EncodeToString(raw)); err != nil {
			_ = f.Close()
			return nil, fmt.Errorf("auth: write secret: %w", err)
		}
		if err := f.Close(); err != nil {
			return nil, fmt.Errorf("auth: close secret: %w", err)
		}
	} else if !errors.Is(err, os.ErrExist) {
		return nil, fmt.Errorf("auth: open secret: %w", err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("auth: read secret: %w", err)
	}
	secret := []byte(strings.TrimSpace(string(raw)))
	// A 0-byte (or whitespace-only) secret file would make the HMAC key
	// empty and every cookie forgeable; mint a fresh secret in place.
	if len(secret) == 0 {
		newRaw := make([]byte, 32)
		if _, err := rand.Read(newRaw); err != nil {
			return nil, fmt.Errorf("auth: generate secret: %w", err)
		}
		secret = []byte(hex.EncodeToString(newRaw))
		if err := os.WriteFile(path, secret, 0o600); err != nil {
			return nil, fmt.Errorf("auth: rewrite secret: %w", err)
		}
	}
	return &Sessions{Secret: secret, Days: days}, nil
}

// sign mirrors sign(): payload + '.' + base64url(HMAC-SHA256(secret, payload)).
// Node's 'base64url' digest encoding is unpadded URL-safe base64.
func (s *Sessions) sign(payload string) string {
	mac := hmac.New(sha256.New, s.Secret)
	mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// verifySig mirrors verifySig(): split on the LAST '.', recompute the MAC and
// compare timing-safely. Node's timingSafeEqual throws on length mismatch
// (caught → null); hmac.Equal simply returns false — same outcome.
func (s *Sessions) verifySig(token string) (string, bool) {
	payload, mac, ok := strings.CutLast(token, ".")
	if !ok {
		return "", false
	}
	_, expectedMAC, _ := strings.CutLast(s.sign(payload), ".")
	if !hmac.Equal([]byte(mac), []byte(expectedMAC)) {
		return "", false
	}
	return payload, true
}

// Make issues a signed session cookie value for uid at version sv and returns
// it together with Max-Age in seconds. Payload is `<uid>:<exp-ms>:<sv>`
// (makeSession, server.js lines 173–176).
func (s *Sessions) Make(uid string, sv int) (cookieValue string, maxAge int) {
	exp := time.Now().Add(time.Duration(s.Days) * 24 * time.Hour).UnixMilli()
	return s.sign(fmt.Sprintf("%s:%d:%d", uid, exp, sv)), s.Days * 86400
}

// Read verifies a current three-field cookie and checks expiry and session version.
func (s *Sessions) Read(cookieVal string, lookup func(uid string) (sv int, disabled bool)) (uid string, ok bool) {
	payload, ok := s.verifySig(cookieVal)
	if !ok {
		return "", false
	}
	parts := strings.Split(payload, ":")
	if len(parts) != 3 || parts[0] == "" {
		return "", false
	}
	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || expiry < time.Now().UnixMilli() {
		return "", false
	}
	claimed, err := strconv.Atoi(parts[2])
	if err != nil || claimed < 0 {
		return "", false
	}
	version, disabled := lookup(parts[0])
	if disabled || version != claimed {
		return "", false
	}
	return parts[0], true
}
