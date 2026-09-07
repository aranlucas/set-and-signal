package store

import (
	"context"
	"encoding/json/jsontext"
	"fmt"
)

// UserSummary is the admin list projection. Keep full training documents in
// SQLite instead of allocating every workout and set just to count them.
type TrainingSummary struct {
	Workouts              int
	LastWorkout, LastSync jsontext.Value
}

type UserSummary struct {
	User
	Workouts    int
	LastWorkout jsontext.Value
	LastSync    jsontext.Value
	HasPush     bool
}

func (s *Store) UserSummaries(ctx context.Context) ([]UserSummary, error) {
	if s.Training != nil {
		users, err := s.Users()
		if err != nil {
			return nil, err
		}
		summaries := make([]UserSummary, 0, len(users))
		for _, user := range users {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			source, ok := s.Training.(interface {
				Summary(string) (TrainingSummary, error)
			})
			if !ok {
				return nil, fmt.Errorf("training backend does not provide summaries")
			}
			projection, err := source.Summary(user.ID)
			if err != nil {
				return nil, err
			}
			summary := UserSummary{User: user, Workouts: projection.Workouts, LastSync: projection.LastSync, LastWorkout: projection.LastWorkout}
			summary.HasPush, err = s.AnySubFor(user.ID)
			if err != nil {
				return nil, err
			}
			summaries = append(summaries, summary)
		}
		return summaries, nil
	}

	rows, err := s.DB.QueryContext(ctx, `
		SELECT u.id, coalesce(u.name,''), coalesce(u.created,''), u.disabled, u.sv, u.admin,
		       coalesce(u.invited_by,''), coalesce(u.last_reminder,''),
		       coalesce(json_array_length(s.state, '$.workouts'), 0),
		       coalesce(s.state -> '$.workouts[#-1].d', 'null'),
		       CASE WHEN json_type(s.state, '$._ts') IN ('integer', 'real')
		                 AND json_extract(s.state, '$._ts') != 0
		            THEN s.state -> '$._ts' ELSE 'null' END,
		       EXISTS(SELECT 1 FROM push_subs p WHERE p.user_id = u.id),
		       coalesce(json_type(s.state), 'null')
		FROM users u LEFT JOIN user_state s ON s.user_id = u.id
		ORDER BY u.created`)
	if err != nil {
		return nil, fmt.Errorf("store: user summaries: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := make([]UserSummary, 0)
	for rows.Next() {
		var summary UserSummary
		var disabled, admin int
		var lastWorkout, lastSync, stateType string
		if err := rows.Scan(&summary.ID, &summary.Name, &summary.Created,
			&disabled, &summary.SV, &admin, &summary.InvitedBy, &summary.LastReminder,
			&summary.Workouts, &lastWorkout, &lastSync, &summary.HasPush, &stateType); err != nil {
			return nil, fmt.Errorf("store: scan user summary: %w", err)
		}
		if stateType != "object" && stateType != "null" {
			return nil, fmt.Errorf("store: state for %s must be a JSON object", summary.ID)
		}
		summary.Disabled = disabled != 0
		summary.Admin = admin != 0
		summary.LastWorkout = jsontext.Value(lastWorkout)
		summary.LastSync = jsontext.Value(lastSync)
		out = append(out, summary)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: user summaries: %w", err)
	}
	return out, nil
}
