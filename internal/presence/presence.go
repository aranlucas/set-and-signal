// Package presence tracks live workout sessions: which user is on which
// exercise and set, expiring entries 70 s after their last update.
package presence

import (
	"context"
	"sync"
	"time"
)

// TTL is how long an entry stays live after its last update.
const TTL = 70 * time.Second

// Info mirrors the upstream presence payload for one user's current exercise.
type Info struct {
	Name      string
	ExIdx     int
	ExTotal   int
	SetsDone  int
	SetsTotal int
	StartedAt time.Time
	UpdatedAt time.Time
}

// Presence maps uid → live Info. Now is injectable so tests can drive the
// clock; a nil Now falls back to time.Now.
type Presence struct {
	Now func() time.Time

	mu              sync.Mutex
	m               map[string]*Info
	janitorInterval time.Duration // zero ⇒ 10s; overridable in tests
}

// New returns a ready Presence with the real clock.
func New() *Presence {
	return &Presence{m: make(map[string]*Info)}
}

func (p *Presence) now() time.Time {
	if p.Now != nil {
		return p.Now()
	}
	return time.Now()
}

// Set records (or refreshes) uid's info, stamping UpdatedAt with the injected
// clock. A zero StartedAt inherits the previous entry's start or now.
func (p *Presence) Set(uid string, info Info) {
	now := p.now()
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.m == nil {
		p.m = make(map[string]*Info)
	}
	if info.StartedAt.IsZero() {
		if prev := p.m[uid]; prev != nil && !prev.StartedAt.IsZero() {
			info.StartedAt = prev.StartedAt
		} else {
			info.StartedAt = now
		}
	}
	info.UpdatedAt = now
	p.m[uid] = &info
}

// Delete removes uid immediately (workout ended / client said goodbye).
func (p *Presence) Delete(uid string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.m, uid)
}

// Live returns uid's info while it is younger than TTL, else nil. Expired
// entries are dropped lazily here as well as by RunJanitor.
func (p *Presence) Live(uid string) *Info {
	now := p.now()
	p.mu.Lock()
	defer p.mu.Unlock()
	info := p.m[uid]
	if info == nil || now.Sub(info.UpdatedAt) >= TTL {
		delete(p.m, uid)
		return nil
	}
	cp := *info
	return &cp
}

// RunJanitor drops expired entries on a ticker until ctx is cancelled.
func (p *Presence) RunJanitor(ctx context.Context) {
	interval := p.janitorInterval
	if interval <= 0 {
		interval = 10 * time.Second
	}
	ticks := time.Tick(interval)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticks:
			now := p.now()
			p.mu.Lock()
			for uid, info := range p.m {
				if now.Sub(info.UpdatedAt) >= TTL {
					delete(p.m, uid)
				}
			}
			p.mu.Unlock()
		}
	}
}
