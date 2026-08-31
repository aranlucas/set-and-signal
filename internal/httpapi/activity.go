package httpapi

import (
	"net/http"
	"time"

	"github.com/aranlucas/set-and-signal/internal/presence"
	"github.com/aranlucas/set-and-signal/internal/sanitize"
)

// POST /api/activity — live-workout heartbeat (server.js lines 754–769).
// The client pings while a workout is on screen; active:false drops the
// entry. Cookie-only, like upstream's readSession guard.
func (s *Server) postActivity(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	var body struct {
		Active    any `json:"active"`
		Name      any `json:"name"`
		ExIdx     any `json:"exIdx"`
		ExTotal   any `json:"exTotal"`
		SetsDone  any `json:"setsDone"`
		SetsTotal any `json:"setsTotal"`
		StartedAt any `json:"startedAt"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if jsTruthy(body.Active) {
		started := plusOrZero(body.StartedAt)
		if started == 0 { // +body.startedAt || Date.now()
			started = float64(time.Now().UnixMilli())
		}
		s.Presence.Set(u.ID, presence.Info{
			Name:      jsSlice(sanitize.JSString(body.Name), 60),
			ExIdx:     int(plusOrZero(body.ExIdx)),
			ExTotal:   int(plusOrZero(body.ExTotal)),
			SetsDone:  int(plusOrZero(body.SetsDone)),
			SetsTotal: int(plusOrZero(body.SetsTotal)),
			StartedAt: time.UnixMilli(int64(started)),
		})
	} else {
		s.Presence.Delete(u.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
