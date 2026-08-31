// Package api serves the HTTP surface: public info, passkey/OIDC auth,
// whole-state sync, and granular state edits. Whole-state PUT, /api/me,
// logout/all and admin stay cookie-only; GET data and the granular edits
// also accept OAuth bearer tokens (MCP / agents).
package httpapi

import (
	"encoding/json/v2"
	"errors"
	"net/http"
)

// maxBody mirrors upstream MAX_BODY (5 MiB cap per request body).
const maxBody = 5 * 1024 * 1024

// writeJSON sends v as JSON with the same headers upstream's json() helper
// sets (Content-Type application/json, Cache-Control no-store).
func writeJSON(w http.ResponseWriter, code int, v any) {
	b, err := json.Marshal(v)
	if err != nil {
		code = http.StatusInternalServerError
		b = []byte(`{"error":"server error"}`)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_, _ = w.Write(b)
}

// writeErr sends the upstream error envelope {"error": msg}.
func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// serverError is the generic 500 envelope upstream's dispatcher catch emits.
func serverError(w http.ResponseWriter) { writeErr(w, http.StatusInternalServerError, "server error") }

// readJSON decodes the request body into dst under the 5 MiB cap. Oversized
// bodies answer {"error":"body too large"}; malformed JSON answers
// {"error":"bad json"}. Returns false when the response is already written.
func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	if err := json.UnmarshalRead(r.Body, dst, json.RejectUnknownMembers(true)); err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			writeErr(w, http.StatusRequestEntityTooLarge, "body too large")
		} else {
			writeErr(w, http.StatusBadRequest, "bad json")
		}
		return false
	}
	return true
}
