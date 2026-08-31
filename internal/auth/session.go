// Package auth ports session-cookie signing from upstream api/server.js
// §"sessions": HMAC-SHA256 signed `uid:expiry:sv` cookies.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Sessions signs and verifies `gymsid` cookie values. Secret is the raw
// (trimmed) contents of $DATA_DIR/secret — the same bytes server.js uses as
// its HMAC key, so cookies stay interoperable across both implementations.
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
	} else if !os.IsExist(err) {
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

// Read verifies a cookie value and resolves its user via lookup, which must
// report the user's current sv counter and disabled flag; report unknown
// users as disabled. Mirrors readSession (server.js lines 177–195):
// signature → non-empty uid → expiry → user exists → not disabled → sv match,
// with a missing third payload field meaning version 0 (legacy cookies).
func (s *Sessions) Read(cookieVal string, lookup func(uid string) (sv int, disabled bool)) (uid string, ok bool) {
	payload, ok := s.verifySig(cookieVal)
	if !ok {
		return "", false
	}
	parts := strings.Split(payload, ":")
	uid = parts[0]
	if uid == "" {
		return "", false
	}
	// +exp < Date.now(): junk exp coerces to NaN, which fails the comparison
	// and falls through to the sv check, exactly like upstream.
	expStr := ""
	if len(parts) > 1 {
		expStr = parts[1]
	}
	if exp, ok := jsToNumber(expStr); ok && exp < float64(time.Now().UnixMilli()) {
		return "", false
	}
	sv, disabled := lookup(uid)
	if disabled {
		return "", false
	}
	var claimed float64
	if len(parts) > 2 {
		n, ok := jsToNumber(parts[2])
		if !ok || n != math.Trunc(n) { // Number.isInteger: NaN/±Inf/fractions fail
			return "", false
		}
		claimed = n
	} // missing third field ⇒ pre-versioning cookie ⇒ version 0
	if claimed != float64(sv) {
		return "", false
	}
	return uid, true
}

// jsToNumber approximates JS unary + on a decimal string: pure whitespace is
// zero, anything else parses as a float; garbage reports !ok (NaN).
func jsToNumber(s string) (float64, bool) {
	t := strings.TrimFunc(s, isJSWhitespace)
	if t == "" {
		return 0, true
	}
	f, err := strconv.ParseFloat(t, 64)
	if err != nil {
		return 0, false
	}
	return f, true
}

func isJSWhitespace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0x1680, 0x2028, 0x2029,
		0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}
