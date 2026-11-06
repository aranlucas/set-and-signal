package oauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/aranlucas/set-and-signal/internal/auth"
	"github.com/aranlucas/set-and-signal/internal/config"
	"github.com/aranlucas/set-and-signal/internal/store"
	"github.com/go-chi/chi/v5"
)

type fixtureProvider struct {
	id    string
	calls int
	wait  bool
}

func (p *fixtureProvider) ID() string    { return p.id }
func (p *fixtureProvider) Label() string { return p.id }
func (p *fixtureProvider) AuthCodeURL(state, redirect string) (string, error) {
	return "https://idp.example/authorize?state=" + url.QueryEscape(state), nil
}
func (p *fixtureProvider) Exchange(ctx context.Context, _ string, _ string) (*UserInfo, error) {
	p.calls++
	if p.wait {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return &UserInfo{Subject: "subject", Name: "Tester"}, nil
}

func TestLoginBrowserAndProviderBinding(t *testing.T) {
	for _, mcp := range []bool{false, true} {
		t.Run(map[bool]string{false: "web", true: "mcp"}[mcp], func(t *testing.T) {
			st, err := store.Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer st.DB.Close()
			s := New(config.Config{PublicURL: "https://app.example", Origin: "https://app.example"}, st, &auth.Sessions{Secret: []byte("test"), Days: 1})
			p := &fixtureProvider{id: "fixture"}
			other := &fixtureProvider{id: "other"}
			s.providers = map[string]Provider{"fixture": p, "other": other, "apple": &fixtureProvider{id: "apple"}}
			router := chi.NewRouter()
			s.Mount(router)
			s.logins["expired"] = loginPending{Exp: time.Now().Add(-time.Hour)}
			start := "/oauth/web/fixture"
			if mcp {
				if err := st.SaveOAuthClient(store.OAuthClient{ClientID: "client", RedirectURIs: []string{"https://client.example/cb"}, GrantTypes: []string{"authorization_code"}}); err != nil {
					t.Fatal(err)
				}
				start = "/oauth/authorize?response_type=code&client_id=client&redirect_uri=https://client.example/cb&code_challenge=challenge&code_challenge_method=S256"
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest("GET", start, nil))
			if w.Code != 302 {
				t.Fatalf("start: %d %s", w.Code, w.Body)
			}
			if _, ok := s.logins["expired"]; ok {
				t.Fatal("expired login retained")
			}
			loc, _ := url.Parse(w.Header().Get("Location"))
			state := loc.Query().Get("state")
			cookies := w.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("binding cookies=%v", cookies)
			}
			cookie := cookies[0]
			if !cookie.HttpOnly || !cookie.Secure {
				t.Fatal("unsafe binding cookie")
			}
			if mcp {
				w = httptest.NewRecorder()
				req := httptest.NewRequest("GET", "/oauth/callback/fixture?start=1&state="+state, nil)
				req.AddCookie(cookie)
				router.ServeHTTP(w, req)
				if w.Code != 302 {
					t.Fatalf("provider start: %d %s", w.Code, w.Body)
				}
			}
			callback := "/oauth/callback/fixture?state=" + state + "&code=valid"
			for _, mismatch := range []string{"missing", "wrong", "provider"} {
				req := httptest.NewRequest("GET", callback, nil)
				if mismatch == "wrong" {
					req.AddCookie(&http.Cookie{Name: cookie.Name, Value: "wrong"})
				}
				if mismatch == "provider" {
					req = httptest.NewRequest("GET", strings.Replace(callback, "fixture", "other", 1), nil)
					req.AddCookie(cookie)
				}
				w = httptest.NewRecorder()
				router.ServeHTTP(w, req)
				if w.Code != 400 || p.calls != 0 || other.calls != 0 {
					t.Fatalf("accepted %s: status=%d calls=%d", mismatch, w.Code, p.calls)
				}
			}
			req := httptest.NewRequest("GET", callback, nil)
			req.AddCookie(cookie)
			w = httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != 302 || p.calls != 1 {
				t.Fatalf("valid callback: %d %s calls=%d", w.Code, w.Body, p.calls)
			}
			found := false
			for _, c := range w.Result().Cookies() {
				if c.Name == "gymsid" && c.Value != "" {
					found = true
				}
			}
			if !found {
				t.Fatal("missing session")
			}
			w = httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != 400 || p.calls != 1 {
				t.Fatal("callback replayed")
			}
			// Apple sends the callback fields in a cross-site form POST.
			w = httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest("GET", "/oauth/web/apple", nil))
			cookie = w.Result().Cookies()[0]
			if cookie.SameSite != http.SameSiteNoneMode || !cookie.Secure {
				t.Fatal("Apple POST cookie blocked")
			}
			loc, _ = url.Parse(w.Header().Get("Location"))
			state = loc.Query().Get("state")
			req = httptest.NewRequest("POST", "/oauth/callback/apple", strings.NewReader(url.Values{"state": {state}, "code": {"valid"}}.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.AddCookie(cookie)
			w = httptest.NewRecorder()
			router.ServeHTTP(w, req)
			if w.Code != 302 {
				t.Fatalf("Apple POST: %d %s", w.Code, w.Body)
			}
		})
	}
}

// A captured callback is insufficient to sign a different browser into its account.
func TestLoginRejectsForeignBrowser(t *testing.T) {
	p := &fixtureProvider{id: "fixture"}
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer st.DB.Close()
	s := New(config.Config{PublicURL: "https://app.example"}, st, &auth.Sessions{Secret: []byte("test"), Days: 1})
	s.providers["fixture"] = p
	s.logins["captured"] = loginPending{BrowserLogin: true, ProviderID: "fixture", BrowserNonce: hashSecret("original-browser"), Exp: time.Now().Add(time.Minute)}
	router := chi.NewRouter()
	s.Mount(router)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/oauth/callback/fixture?state=captured&code=valid", nil))
	if w.Code != http.StatusBadRequest || p.calls != 0 {
		t.Fatalf("foreign browser reached exchange: status=%d calls=%d", w.Code, p.calls)
	}
}

func TestProviderExchangeHasDeadline(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		s := New(config.Config{PublicURL: "https://app.example"}, nil, nil)
		p := &fixtureProvider{id: "fixture", wait: true}
		s.providers["fixture"] = p
		s.logins["pending"] = loginPending{BrowserLogin: true, ProviderID: "fixture", BrowserNonce: hashSecret("nonce"), Exp: time.Now().Add(time.Minute)}
		router := chi.NewRouter()
		s.Mount(router)
		req := httptest.NewRequest("GET", "/oauth/callback/fixture?state=pending&code=valid", nil)
		req.AddCookie(&http.Cookie{Name: "oauth_login_" + hashSecret("pending"), Value: "nonce"})
		w := httptest.NewRecorder()
		start := time.Now()
		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "deadline exceeded") {
			t.Fatalf("timeout response: %d %s", w.Code, w.Body)
		}
		if time.Since(start) != 30*time.Second {
			t.Fatalf("exchange duration=%v", time.Since(start))
		}
	})
}
