package httpapi

import (
	"net/http"
	"strings"
)

// GET /api/health — liveness plus the user count the login screen shows.
func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	users, err := s.ST.Users()
	if err != nil {
		serverError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "users": len(users)})
}

// GET /api/config — public config the login screen needs before anyone is
// signed in.
func (s *Server) config(w http.ResponseWriter, _ *http.Request) {
	providers := []string{}
	if s.OAuth != nil {
		providers = s.OAuth.ProviderIDs()
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"invite_only":    s.Cfg.InviteOnly,
		"oidc_providers": providers,
		"mcp_url":        strings.TrimRight(s.Cfg.PublicURL, "/") + "/mcp",
	})
}

// GET /api/me — identity probe; cookie sessions only (upstream readSession).
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": s.userPayload(*u)})
}
