package convex

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTokenAndCompareAndSwapRetry(t *testing.T) {
	c, err := New("", "https://api.example.test", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	token, err := c.Token("alice", false)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := jwt.Parse(token, func(*jwt.Token) (any, error) { return &c.key.PublicKey, nil }, jwt.WithValidMethods([]string{"RS256"}), jwt.WithAudience("set-and-signal"), jwt.WithIssuer(c.Issuer))
	if err != nil || !parsed.Valid {
		t.Fatalf("token invalid: %v", err)
	}
	claims := parsed.Claims.(jwt.MapClaims)
	if claims["sub"] != "alice" || claims["service"] != false {
		t.Fatalf("claims: %v", claims)
	}
	reads, writes := 0, 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Path string                    `json:"path"`
			Args map[string]jsontext.Value `json:"args"`
		}
		if err := json.UnmarshalRead(r.Body, &body); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if body.Path == "training:snapshot" {
			reads++
			json.MarshalWrite(w, map[string]any{"status": "success", "value": map[string]any{"_ts": reads, "restSec": 60}})
		} else {
			writes++
			if string(body.Args["expected"]) != string(rune('0'+reads)) {
				t.Errorf("wrong revision %s", body.Args["expected"])
			}
			json.MarshalWrite(w, map[string]any{"status": "success", "value": writes > 1})
		}
	}))
	defer srv.Close()
	c.URL = srv.URL
	calls := 0
	if err := c.MutateState("alice", func(raw jsontext.Value) (jsontext.Value, error) { calls++; return raw, nil }); err != nil {
		t.Fatal(err)
	}
	if reads != 2 || writes != 2 || calls != 2 {
		t.Fatalf("retry counts %d %d %d", reads, writes, calls)
	}
}

func TestMigrationRejectsLossyNumbers(t *testing.T) {
	for _, raw := range []string{`{"future":9007199254740993}`, `{"future":0.1234567890123456789}`} {
		if err := checkJSONNumbers(jsontext.Value(raw)); err == nil {
			t.Fatalf("accepted lossy input %s", raw)
		}
	}
	if err := checkJSONNumbers(jsontext.Value(`{"w":0.1,"t":1780000000000,"n":1e3}`)); err != nil {
		t.Fatal(err)
	}
}
