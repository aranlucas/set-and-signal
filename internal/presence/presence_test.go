package presence

import (
	"context"
	"sync"
	"testing"
	"testing/synctest"
	"time"
)

// fakeClock returns a goroutine-safe Now func plus a time-advance helper.
func fakeClock(start time.Time) (func() time.Time, func(time.Duration)) {
	var mu sync.Mutex
	now := start
	return func() time.Time {
			mu.Lock()
			defer mu.Unlock()
			return now
		},
		func(d time.Duration) {
			mu.Lock()
			defer mu.Unlock()
			now = now.Add(d)
		}
}

func TestSetLiveDelete(t *testing.T) {
	start := time.Date(2026, 8, 23, 10, 0, 0, 0, time.UTC)
	get, _ := fakeClock(start)
	p := New()
	p.Now = get

	if p.Live("u1") != nil {
		t.Fatal("unknown uid must not be live")
	}

	p.Set("u1", Info{Name: "Bench Press", ExIdx: 2, ExTotal: 5, SetsDone: 3, SetsTotal: 4})
	info := p.Live("u1")
	if info == nil || info.Name != "Bench Press" || info.ExIdx != 2 ||
		info.ExTotal != 5 || info.SetsDone != 3 || info.SetsTotal != 4 {
		t.Fatalf("Live = %+v, want recorded info", info)
	}
	if !info.StartedAt.Equal(start) || !info.UpdatedAt.Equal(start) {
		t.Fatalf("timestamps = %v/%v, want %v", info.StartedAt, info.UpdatedAt, start)
	}
	// Live must return a copy: mutating it must not corrupt the map.
	info.SetsDone = 99
	if p.Live("u1").SetsDone != 3 {
		t.Fatal("Live must return a defensive copy")
	}

	p.Delete("u1")
	if p.Live("u1") != nil {
		t.Fatal("deleted uid must not be live")
	}
}

func TestTTLExpiryWithFakeClock(t *testing.T) {
	start := time.Unix(0, 0)
	get, advance := fakeClock(start)
	p := New()
	p.Now = get

	p.Set("u1", Info{Name: "Squat"})
	advance(TTL - time.Second)
	if p.Live("u1") == nil {
		t.Fatal("entry younger than TTL must be live")
	}
	advance(2 * time.Second) // past TTL
	if p.Live("u1") != nil {
		t.Fatal("entry older than TTL must be nil")
	}
	// Re-setting revives with a fresh window.
	p.Set("u1", Info{Name: "Squat"})
	if p.Live("u1") == nil {
		t.Fatal("refreshed entry must be live")
	}
}

func TestStartedAtCarriesAcrossRefresh(t *testing.T) {
	start := time.Unix(1755900000, 0)
	get, advance := fakeClock(start)
	p := New()
	p.Now = get

	p.Set("u1", Info{Name: "Row"})
	advance(30 * time.Second)
	p.Set("u1", Info{Name: "Row", SetsDone: 1}) // zero StartedAt inherits
	info := p.Live("u1")
	if !info.StartedAt.Equal(start) {
		t.Fatalf("StartedAt = %v, want original %v", info.StartedAt, start)
	}
	if !info.UpdatedAt.Equal(start.Add(30 * time.Second)) {
		t.Fatalf("UpdatedAt = %v, want refreshed time", info.UpdatedAt)
	}
	// Explicit StartedAt wins.
	explicit := start.Add(-5 * time.Minute)
	p.Set("u1", Info{Name: "Row", StartedAt: explicit})
	if !p.Live("u1").StartedAt.Equal(explicit) {
		t.Fatal("explicit StartedAt must be preserved")
	}
}

func TestRunJanitorCleansExpiredEntries(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		start := time.Unix(0, 0)
		get, advance := fakeClock(start)
		p := New()
		p.Now = get
		p.janitorInterval = 2 * time.Millisecond
		p.Set("u1", Info{Name: "Press"})
		p.Set("u2", Info{Name: "Deadlift"})

		ctx, cancel := context.WithCancel(t.Context())
		done := make(chan struct{})
		go func() {
			p.RunJanitor(ctx)
			close(done)
		}()

		advance(2 * TTL)
		synctest.Sleep(p.janitorInterval)
		p.mu.Lock()
		left := len(p.m)
		p.mu.Unlock()
		if left != 0 {
			t.Fatalf("janitor left %d entries in the map", left)
		}

		cancel()
		synctest.Wait()
		select {
		case <-done:
		default:
			t.Fatal("RunJanitor must return when ctx is cancelled")
		}
	})
}
