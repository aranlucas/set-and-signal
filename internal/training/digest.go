package training

import (
	"fmt"
	"strconv"
	"time"
)

// todayISOLocal returns YYYY-MM-DD in the given IANA timezone (empty → UTC).
func todayISOLocal(tz string, now time.Time) string {
	loc := time.UTC
	if tz != "" {
		if l, err := time.LoadLocation(tz); err == nil {
			loc = l
		}
	}
	t := now.In(loc)
	return fmt.Sprintf("%04d-%02d-%02d", t.Year(), int(t.Month()), t.Day())
}

// weekdayKey returns "0".."6" for Sunday..Saturday of an ISO calendar date (noon local).
func weekdayKey(iso string) string {
	t, err := time.ParseInLocation("2006-01-02", iso, time.Local)
	if err != nil {
		t, err = time.Parse("2006-01-02", iso)
		if err != nil {
			return "0"
		}
	}
	// Match JS: new Date(`${iso}T12:00:00`) in local — use UTC noon to avoid DST edge flip.
	t = time.Date(t.Year(), t.Month(), t.Day(), 12, 0, 0, 0, time.UTC)
	return strconv.Itoa(int(t.Weekday()))
}

type historyQuery struct {
	Since      string
	Until      string
	ExerciseID string
	Limit      int
}
