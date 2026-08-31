package api

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"net/http"
)

// GET /api/data — whole-state read; cookie session OR bearer token.
// No state on file serializes as {"state":null}, like upstream's catch arm.
func (s *Server) getData(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	raw, err := s.ST.ReadState(u.ID)
	if err != nil {
		serverError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]jsontext.Value{"state": raw})
}

// PUT /api/data — whole-state write. Deliberately cookie-ONLY (upstream uses
// readSession): an LLM with a bad day should never be able to overwrite an
// entire profile. The in-progress-workout `active` key is stripped — those
// stay device-local.
func (s *Server) putData(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	var body struct {
		State map[string]any `json:"state"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.State == nil {
		writeErr(w, http.StatusBadRequest, "state required")
		return
	}
	delete(body.State, "active")
	raw, err := json.Marshal(body.State)
	if err != nil {
		serverError(w)
		return
	}
	if err := s.ST.WriteState(u.ID, raw); err != nil {
		serverError(w)
		return
	}
	var ts any // upstream: body.state._ts || null
	if f, ok := body.State["_ts"].(float64); ok && f != 0 {
		ts = f
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "ts": ts})
}
