package api

import (
	"math"
	"net/http"
	"time"

	"github.com/aranlucas/set-and-signal/internal/sanitize"
	"github.com/aranlucas/set-and-signal/internal/store"
)

// Push notification endpoints (server.js lines 707–752). All mutating push
// routes are cookie-only, like upstream's readSession guard; only the VAPID
// public key is public.

// GET /api/push/public-key — no auth upstream; the frontend needs the key to
// subscribe before anyone signs in.
func (s *Server) pushPublicKey(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"key": s.Push.PublicKey()})
}

// POST /api/push/subscribe — records one subscription per endpoint, replacing
// any earlier row with the same endpoint.
func (s *Server) postPushSubscribe(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	var body struct {
		Subscription any `json:"subscription"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	sub, _ := body.Subscription.(map[string]any)
	keys, _ := sub["keys"].(map[string]any)
	endpoint := sanitize.JSString(sub["endpoint"])
	p256dh := sanitize.JSString(keys["p256dh"])
	auth := sanitize.JSString(keys["auth"])
	if endpoint == "" || p256dh == "" || auth == "" {
		writeErr(w, http.StatusBadRequest, "invalid subscription")
		return
	}
	if err := s.ST.UpsertPushSub(store.PushSub{
		Endpoint: endpoint,
		UserID:   u.ID,
		P256DH:   p256dh,
		Auth:     auth,
		Created:  time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		serverError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/push/unsubscribe — drops one of *the caller's* subscriptions by
// endpoint; unknown endpoints still answer ok like upstream's filter no-op.
func (s *Server) postPushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	var body struct {
		Endpoint any `json:"endpoint"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	endpoint := sanitize.JSString(body.Endpoint)
	subs, err := s.ST.SubsByUser(u.ID)
	if err != nil {
		serverError(w)
		return
	}
	for _, sub := range subs {
		if sub.Endpoint == endpoint {
			if err := s.ST.DeletePushSub(endpoint); err != nil {
				serverError(w)
				return
			}
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/push/test — one sample notification so the user can check their
// device actually receives alerts.
func (s *Server) postPushTest(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	s.Push.SendTo(u.ID, "Set & Signal", "Test notification ✅ — this is what alerts look like.", "test")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/push/rest-timer — arms the rest-over alert. Upstream clamps
// Math.max(1, Math.min(3600, Math.round(+body.seconds || 0))): the `|| 0`
// collapses NaN to 0 before the clamp, so garbage input schedules a 1s
// timer rather than erroring.
func (s *Server) postRestTimer(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	var body struct {
		Seconds any `json:"seconds"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	sec := math.Max(1, math.Min(3600, jsRoundF(plusOrZero(body.Seconds))))
	s.Push.ScheduleRestTimer(u.ID, int(sec))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /api/push/rest-timer/cancel — disarms the pending rest timer.
func (s *Server) postRestTimerCancel(w http.ResponseWriter, r *http.Request) {
	u := s.requireSession(w, r)
	if u == nil {
		return
	}
	s.Push.CancelRestTimer(u.ID)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
