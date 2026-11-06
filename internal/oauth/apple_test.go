package oauth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"net/url"
	"testing"

	"github.com/aranlucas/set-and-signal/internal/config"
)

func TestAppleProfileScopesUseFormPost(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	p := newAppleProvider(config.Config{AppleClientID: "client", AppleTeamID: "team", AppleKeyID: "key", ApplePrivateKey: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: raw}))})
	authURL, err := p.AuthCodeURL("state", "https://app.example/oauth/callback/apple")
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(authURL)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Query().Get("scope") != "name email" || parsed.Query().Get("response_mode") != "form_post" {
		t.Fatalf("invalid scoped Apple request: %s", authURL)
	}
}
