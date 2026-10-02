package httpapi

import (
	"encoding/json/jsontext"
	"net/http"
)

// GET /api/data — whole-state read; cookie session OR bearer token.
// A user with no stored state receives {"state":null}.
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
	writeJSON(w, http.StatusOK, struct {
		State jsontext.Value `json:"state"`
	}{State: raw})
}
