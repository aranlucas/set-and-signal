package oauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/aranlucas/set-and-signal/internal/store"
)

// GET /oauth/authorize — Authorization Code + PKCE entry point.
func (s *Server) authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	clientID := q.Get("client_id")
	redirectURI := q.Get("redirect_uri")
	responseType := q.Get("response_type")
	state := q.Get("state")
	challenge := q.Get("code_challenge")
	method := q.Get("code_challenge_method")
	scope := q.Get("scope")
	resource := q.Get("resource")

	if responseType != "code" {
		http.Error(w, "unsupported_response_type", http.StatusBadRequest)
		return
	}
	if clientID == "" || redirectURI == "" {
		http.Error(w, "invalid_request: client_id and redirect_uri required", http.StatusBadRequest)
		return
	}
	if challenge == "" || method != "S256" {
		http.Error(w, "invalid_request: PKCE S256 required", http.StatusBadRequest)
		return
	}

	client, err := s.ST.OAuthClientByID(clientID)
	if err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}
	if client == nil || !slices.Contains(client.RedirectURIs, redirectURI) {
		http.Error(w, "invalid_request: unknown client or redirect_uri", http.StatusBadRequest)
		return
	}
	if resource == "" {
		resource = s.ResourceURI()
	}
	if scope == "" {
		scope = ScopeAll
	}

	if u := s.sessionUser(r); u != nil {
		s.issueCodeRedirect(w, r, u, clientID, redirectURI, state, challenge, method, scope, resource)
		return
	}

	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}
	loginState := base64.RawURLEncoding.EncodeToString(raw)
	nonce, err := s.loginBrowser(w, loginState, false)
	if err != nil {
		http.Error(w, "server_error", 500)
		return
	}
	s.mu.Lock()
	s.pruneLogins()
	s.logins[loginState] = loginPending{
		BrowserNonce:        nonce,
		ClientID:            clientID,
		RedirectURI:         redirectURI,
		State:               state,
		CodeChallenge:       challenge,
		CodeChallengeMethod: method,
		Scope:               scope,
		Resource:            resource,
		Exp:                 time.Now().Add(loginTTL),
	}
	s.mu.Unlock()

	http.Redirect(w, r, "/oauth/login?state="+url.QueryEscape(loginState), http.StatusFound)
}

func (s *Server) issueCodeRedirect(w http.ResponseWriter, r *http.Request, u *store.User, clientID, redirectURI, state, challenge, method, scope, resource string) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}
	code := base64.RawURLEncoding.EncodeToString(raw)
	if err := s.ST.SaveOAuthCode(store.OAuthCode{
		CodeHash:            hashSecret(code),
		ClientID:            clientID,
		UserID:              u.ID,
		RedirectURI:         redirectURI,
		CodeChallenge:       challenge,
		CodeChallengeMethod: method,
		Scope:               scope,
		Resource:            resource,
		Exp:                 time.Now().Add(codeTTL).Unix(),
	}); err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}

	ru, err := url.Parse(redirectURI)
	if err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}
	qv := ru.Query()
	qv.Set("code", code)
	if state != "" {
		qv.Set("state", state)
	}
	qv.Set("iss", s.Issuer())
	ru.RawQuery = qv.Encode()
	http.Redirect(w, r, ru.String(), http.StatusFound)
}

// GET /oauth/login — choose an OIDC provider.
func (s *Server) loginPage(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	s.mu.Lock()
	pending, ok := s.logins[state]
	s.mu.Unlock()
	if !ok || time.Now().After(pending.Exp) {
		http.Error(w, "login session expired — restart from the MCP client", http.StatusBadRequest)
		return
	}
	if len(s.providers) == 0 {
		http.Error(w, "no OIDC providers configured (set GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID / …)", http.StatusServiceUnavailable)
		return
	}

	var b strings.Builder
	b.WriteString(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`)
	b.WriteString(`<title>Sign in — ` + html.EscapeString(s.Cfg.RPName) + `</title>`)
	b.WriteString(`<style>
body{font-family:system-ui,sans-serif;background:#0b0d10;color:#f4f6f8;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:22rem;padding:2rem;text-align:center}
h1{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}
p{color:#9aa3ad;font-size:.875rem;margin:0 0 1.5rem}
a.btn{display:block;padding:.75rem 1rem;margin:.5rem 0;border-radius:.5rem;background:#2563eb;color:#fff;text-decoration:none;font-weight:500}
a.btn:hover{background:#1d4ed8}
</style></head><body><main>`)
	b.WriteString(`<h1>Sign in to ` + html.EscapeString(s.Cfg.RPName) + `</h1>`)
	b.WriteString(`<p>Authorize the MCP client to access your training data.</p>`)
	for id, p := range s.providers {
		href := fmt.Sprintf("/oauth/callback/%s?start=1&state=%s", url.PathEscape(id), url.QueryEscape(state))
		b.WriteString(`<a class="btn" href="` + html.EscapeString(href) + `">Continue with ` + html.EscapeString(p.Label()) + `</a>`)
	}
	b.WriteString(`</main></body></html>`)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(b.String()))
}

// GET /oauth/callback/{provider} — start IdP redirect or handle return.
func (s *Server) oidcCallback(w http.ResponseWriter, r *http.Request) {
	providerID := chi.URLParam(r, "provider")
	p, ok := s.providers[providerID]
	if !ok {
		http.Error(w, "unknown provider", http.StatusNotFound)
		return
	}
	params := r.URL.Query()
	if r.Method == http.MethodPost {
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid callback", 400)
			return
		}
		params = r.PostForm
	}
	state := params.Get("state")

	if r.Method == http.MethodGet && params.Get("start") == "1" {
		s.mu.Lock()
		pending, ok := s.logins[state]
		if ok && s.loginMatches(r, state, pending) {
			pending.ProviderID = providerID
			s.logins[state] = pending
		} else {
			ok = false
		}
		s.mu.Unlock()
		if !ok || time.Now().After(pending.Exp) {
			http.Error(w, "login session expired", http.StatusBadRequest)
			return
		}
		// Apple's cross-site POST needs a SameSite=None binding cookie.
		if providerID == "apple" {
			cookie, _ := r.Cookie(loginCookieName(state))
			s.setLoginCookie(w, state, cookie.Value, true, int(loginTTL.Seconds()))
		}
		authURL, err := p.AuthCodeURL(state, s.callbackURL(providerID))
		if err != nil {
			http.Error(w, "provider misconfigured", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, authURL, http.StatusFound)
		return
	}

	s.mu.Lock()
	pending, ok := s.logins[state]
	if ok && pending.ProviderID == providerID && s.loginMatches(r, state, pending) {
		delete(s.logins, state)
	} else {
		ok = false
	}
	s.mu.Unlock()
	if !ok || time.Now().After(pending.Exp) {
		http.Error(w, "login session expired", http.StatusBadRequest)
		return
	}
	s.setLoginCookie(w, state, "", providerID == "apple", -1)
	if errParam := params.Get("error"); errParam != "" {
		http.Error(w, "IdP error: "+errParam, http.StatusBadRequest)
		return
	}
	code := params.Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	info, err := p.Exchange(ctx, code, s.callbackURL(providerID))
	if err != nil {
		http.Error(w, "token exchange failed: "+err.Error(), http.StatusBadRequest)
		return
	}
	u, err := s.ST.FindOrCreateOIDCUser(providerID, info.Subject, info.Email, info.Name)
	if err != nil || u == nil {
		http.Error(w, "user create failed", http.StatusInternalServerError)
		return
	}
	s.setSessionCookie(w, u)
	if pending.BrowserLogin {
		next := pending.RedirectURI
		if next == "" {
			next = s.Cfg.Origin + "/"
		}
		http.Redirect(w, r, next, http.StatusFound)
		return
	}
	s.issueCodeRedirect(w, r, u, pending.ClientID, pending.RedirectURI, pending.State,
		pending.CodeChallenge, pending.CodeChallengeMethod, pending.Scope, pending.Resource)
}

// GET /oauth/web/{provider} — browser sign-in for the SPA (sets gymsid, no MCP code).
func (s *Server) webLoginStart(w http.ResponseWriter, r *http.Request) {
	providerID := chi.URLParam(r, "provider")
	p, ok := s.providers[providerID]
	if !ok {
		http.Error(w, "unknown provider", http.StatusNotFound)
		return
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		http.Error(w, "server_error", http.StatusInternalServerError)
		return
	}
	state := base64.RawURLEncoding.EncodeToString(raw)
	next := r.URL.Query().Get("next")
	if next == "" || !strings.HasPrefix(next, "/") {
		next = "/"
	}
	nonce, err := s.loginBrowser(w, state, providerID == "apple")
	if err != nil {
		http.Error(w, "server_error", 500)
		return
	}
	s.mu.Lock()
	s.pruneLogins()
	s.logins[state] = loginPending{
		BrowserNonce: nonce,
		ProviderID:   providerID,
		BrowserLogin: true,
		RedirectURI:  strings.TrimRight(s.Cfg.Origin, "/") + next,
		Exp:          time.Now().Add(loginTTL),
	}
	s.mu.Unlock()
	authURL, err := p.AuthCodeURL(state, s.callbackURL(providerID))
	if err != nil {
		http.Error(w, "provider misconfigured", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (s *Server) callbackURL(provider string) string {
	return s.Issuer() + "/oauth/callback/" + provider
}

func pkceS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// Called under mu on each insertion so abandoned states cannot accumulate forever.
func (s *Server) pruneLogins() {
	for state, pending := range s.logins {
		if time.Now().After(pending.Exp) {
			delete(s.logins, state)
		}
	}
}
func loginCookieName(state string) string { return "oauth_login_" + hashSecret(state) }
func (s *Server) setLoginCookie(w http.ResponseWriter, state, nonce string, apple bool, age int) {
	cookie := &http.Cookie{Name: loginCookieName(state), Value: nonce, Path: "/oauth", HttpOnly: true, Secure: strings.HasPrefix(s.Issuer(), "https:"), SameSite: http.SameSiteLaxMode, MaxAge: age}
	if apple {
		cookie.SameSite = http.SameSiteNoneMode
		cookie.Secure = true
	}
	http.SetCookie(w, cookie)
}
func (s *Server) loginBrowser(w http.ResponseWriter, state string, apple bool) (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	nonce := base64.RawURLEncoding.EncodeToString(raw)
	s.setLoginCookie(w, state, nonce, apple, int(loginTTL.Seconds()))
	return hashSecret(nonce), nil
}
func (s *Server) loginMatches(r *http.Request, state string, pending loginPending) bool {
	cookie, err := r.Cookie(loginCookieName(state))
	return err == nil && pending.BrowserNonce != "" && subtle.ConstantTimeCompare([]byte(hashSecret(cookie.Value)), []byte(pending.BrowserNonce)) == 1
}
