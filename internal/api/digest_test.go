package api

import (
	"testing"
	"time"
)

func TestTodayISOLocal(t *testing.T) {
	now := time.Date(2026, 8, 24, 1, 30, 0, 0, time.UTC)
	if got := todayISOLocal("America/Los_Angeles", now); got != "2026-08-23" {
		t.Fatalf("todayISOLocal = %q, want 2026-08-23", got)
	}
}

func TestWeekdayKey(t *testing.T) {
	if got := weekdayKey("2026-08-24"); got != "1" {
		t.Fatalf("weekdayKey = %q, want Monday slot 1", got)
	}
}
