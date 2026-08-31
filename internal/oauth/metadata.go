package oauth

import (
	"encoding/json/v2"
	"net/http"
)

func (s *Server) protectedResourceMetadata(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"resource":                 s.ResourceURI(),
		"authorization_servers":    []string{s.Issuer()},
		"scopes_supported":         []string{ScopeOpenID, ScopeRead, "offline_access"},
		"bearer_methods_supported": []string{"header"},
		"resource_name":            s.Cfg.RPName,
	})
}

func (s *Server) authorizationServerMetadata(w http.ResponseWriter, _ *http.Request) {
	iss := s.Issuer()
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                iss,
		"authorization_endpoint":                iss + "/oauth/authorize",
		"token_endpoint":                        iss + "/oauth/token",
		"registration_endpoint":                 iss + "/oauth/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"none", "client_secret_post", "client_secret_basic"},
		"scopes_supported":                      []string{ScopeOpenID, ScopeRead, "offline_access"},
		"subject_types_supported":               []string{"public"},
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		status = http.StatusInternalServerError
		body = []byte(`{"error":"server_error","error_description":"server error"}`)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeOAuthError(w http.ResponseWriter, status int, code, desc string) {
	writeJSON(w, status, map[string]string{
		"error":             code,
		"error_description": desc,
	})
}
