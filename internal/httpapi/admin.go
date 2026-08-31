package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json/v2"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/aranlucas/set-and-signal/internal/sanitize"
	"github.com/aranlucas/set-and-signal/internal/store"
)

// Admin dashboard endpoints (server.js lines 771–855). Every route is gated
// by requireAdmin — cookie sessions only, bearer tokens are never admin
// credentials.

// adminUserRow is one row of GET /api/admin/users.
func (s *Server) adminUserRow(u store.User, st map[string]any, hasPush bool) map[string]any {
	workouts, _ := st["workouts"].([]any)
	var lastWorkout any
	if len(workouts) > 0 {
		if last, ok := workouts[len(workouts)-1].(map[string]any); ok {
			lastWorkout = last["d"]
		}
	}
	return map[string]any{
		"id":          u.ID,
		"name":        u.Name,
		"created":     orNull(u.Created),
		"disabled":    u.Disabled,
		"admin":       s.isAdmin(&u),
		"invitedBy":   orNull(u.InvitedBy),
		"workouts":    len(workouts),
		"lastWorkout": lastWorkout,
		"lastSync":    falsyNull(st["_ts"]),
		"hasPush":     hasPush,
		"live":        s.livePayload(u.ID),
	}
}

// livePayload renders the caller's presence entry exactly like upstream's
// livePresence(): the raw heartbeat object with millisecond stamps, or null.
func (s *Server) livePayload(uid string) any {
	p := s.Presence.Live(uid)
	if p == nil {
		return nil
	}
	return map[string]any{
		"name":      p.Name,
		"exIdx":     p.ExIdx,
		"exTotal":   p.ExTotal,
		"setsDone":  p.SetsDone,
		"setsTotal": p.SetsTotal,
		"startedAt": p.StartedAt.UnixMilli(),
		"updatedAt": p.UpdatedAt.UnixMilli(),
	}
}

// orNull ports `x || null` for strings.
func orNull(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// falsyNull ports JS `v || null`: 0 / NaN / undefined become null.
func falsyNull(v any) any {
	if f, ok := v.(float64); ok && f != 0 {
		return f
	}
	return nil
}

// readStateMap loads the user's blob for display; a missing row reads as {}.
func (s *Server) readStateMap(uid string) (map[string]any, error) {
	raw, err := s.ST.ReadState(uid)
	if err != nil {
		return nil, err
	}
	var st map[string]any
	if err := json.Unmarshal(raw, &st); err != nil {
		return nil, err
	}
	return st, nil
}

// GET /api/admin/users — one row per user, cheap enough for a personal
// instance (reads each state blob once).
func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	users, err := s.ST.Users()
	if err != nil {
		serverError(w)
		return
	}
	rows := make([]map[string]any, 0, len(users))
	for _, u := range users {
		st, err := s.readStateMap(u.ID)
		if err != nil {
			serverError(w)
			return
		}
		hasPush, err := s.ST.AnySubFor(u.ID)
		if err != nil {
			serverError(w)
			return
		}
		rows = append(rows, s.adminUserRow(u, st, hasPush))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"users": rows, "invite_only": s.Cfg.InviteOnly, "now": time.Now().UnixMilli(),
	})
}

// GET /api/admin/user?id=… — drill-down: full workout history + body-weight
// log for one user, newest workout first.
func (s *Server) adminUser(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	id := r.URL.Query().Get("id")
	u, err := s.ST.UserByID(id) // upstream finds disabled users too
	if err != nil || u == nil {
		writeErr(w, http.StatusNotFound, "no such user")
		return
	}
	st, err := s.readStateMap(u.ID)
	if err != nil {
		serverError(w)
		return
	}

	unit := st["unit"]
	if unitStr, ok := unit.(string); !ok || unitStr == "" {
		unit = "lb"
	}

	type routineSummary struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Emoji string `json:"emoji"`
		Count int    `json:"count"`
	}
	rawRoutines, _ := st["routines"].([]any)
	routines := make([]routineSummary, 0, len(rawRoutines))
	for _, e := range rawRoutines {
		m, ok := e.(map[string]any)
		if !ok {
			continue
		}
		ex, _ := m["ex"].([]any)
		routines = append(routines, routineSummary{
			ID:    sanitize.JSString(m["id"]),
			Name:  sanitize.JSString(m["name"]),
			Emoji: sanitize.JSString(m["emoji"]),
			Count: len(ex),
		})
	}

	bodyweight, _ := st["bodyweight"].([]any)
	if bodyweight == nil {
		bodyweight = []any{}
	}

	rawWorkouts, _ := st["workouts"].([]any)
	workouts := make([]any, 0, len(rawWorkouts)) // newest first for display
	for _, workout := range slices.Backward(rawWorkouts) {
		workouts = append(workouts, workout)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id": u.ID, "name": u.Name,
			"created": orNull(u.Created), "disabled": u.Disabled,
			"admin": s.isAdmin(u), "invitedBy": orNull(u.InvitedBy),
		},
		"unit":       unit,
		"lastSync":   falsyNull(st["_ts"]),
		"routines":   routines,
		"bodyweight": bodyweight,
		"workouts":   workouts,
	})
}

// POST /api/admin/user/disable — flips the disabled flag; refuses admins and
// drops freshly disabled users off "training now" at once.
func (s *Server) adminDisable(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	var body struct {
		ID       any `json:"id"`
		Disabled any `json:"disabled"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	u, err := s.ST.UserByID(sanitize.JSString(body.ID)) // upstream finds disabled users too
	if err != nil || u == nil {
		writeErr(w, http.StatusNotFound, "no such user")
		return
	}
	if s.isAdmin(u) {
		writeErr(w, http.StatusBadRequest, "cannot disable an admin")
		return
	}
	disabled := jsTruthy(body.Disabled) // !!body.disabled
	if err := s.ST.SetDisabled(u.ID, disabled); err != nil {
		serverError(w)
		return
	}
	if disabled {
		s.Presence.Delete(u.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": u.ID, "disabled": disabled})
}

// GET /api/admin/invites — every invite plus usedBy uid → name resolved for
// display.
func (s *Server) adminInvites(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	invites, err := s.ST.Invites()
	if err != nil {
		serverError(w)
		return
	}
	out := make([]map[string]any, 0, len(invites))
	for _, i := range invites {
		var usedByName any
		if i.UsedBy != "" {
			if u, err := s.ST.UserByID(i.UsedBy); err == nil && u != nil { // upstream finds disabled users too
				usedByName = u.Name
			}
		}
		out = append(out, map[string]any{
			"code": i.Code, "note": i.Note,
			"createdBy": i.CreatedBy, "created": i.Created,
			"usedBy": i.UsedBy, "usedAt": i.UsedAt, "revoked": i.Revoked,
			"usedByName": usedByName,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"invites": out, "invite_only": s.Cfg.InviteOnly})
}

// POST /api/admin/invites/new — mints a 16-hex-char code (64 bits; the app
// has no rate limiting by design, so the code itself is what isn't worth
// guessing). Codes already in the database keep working — validation is an
// exact string compare, never a length or format check.
func (s *Server) adminNewInvite(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	var body struct {
		Note any `json:"note"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	existing, err := s.ST.Invites()
	if err != nil {
		serverError(w)
		return
	}
	known := map[string]bool{}
	for _, i := range existing {
		known[i.Code] = true
	}
	var code string
	for {
		var raw [8]byte
		if _, err := rand.Read(raw[:]); err != nil {
			serverError(w)
			return
		}
		code = strings.ToUpper(hex.EncodeToString(raw[:]))
		if !known[code] {
			break
		}
	}
	invite := store.Invite{
		Code:      code,
		Note:      jsSlice(sanitize.JSString(body.Note), 60),
		CreatedBy: admin.ID,
		Created:   time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00"),
	}
	if err := s.ST.UpsertInvite(invite); err != nil {
		serverError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invite": invite})
}

// POST /api/admin/invites/revoke — deletes an unused code; used codes stay
// forever so the audit trail survives.
func (s *Server) adminRevokeInvite(w http.ResponseWriter, r *http.Request) {
	admin := s.requireAdmin(w, r)
	if admin == nil {
		return
	}
	var body struct {
		Code any `json:"code"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	code := strings.ToUpper(sanitize.JSString(body.Code))
	invites, err := s.ST.Invites()
	if err != nil {
		serverError(w)
		return
	}
	var found *store.Invite
	for i := range invites {
		if invites[i].Code == code {
			found = &invites[i]
			break
		}
	}
	if found == nil {
		writeErr(w, http.StatusNotFound, "no such code")
		return
	}
	if found.UsedBy != "" {
		writeErr(w, http.StatusBadRequest, "already used — cannot revoke")
		return
	}
	if err := s.ST.DeleteInvite(found.Code); err != nil {
		serverError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
