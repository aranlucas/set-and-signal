package sanitize

import (
	"math"
	"reflect"
	"strings"
	"testing"
)

func TestNumClamps(t *testing.T) {
	tests := []struct {
		name string
		v    any
		lo   float64
		hi   float64
		want *float64
	}{
		{"in range", 3.0, 1, 12, new(3.0)},
		{"at low edge", 1.0, 1, 12, new(1.0)},
		{"at high edge", 12.0, 1, 12, new(12.0)},
		{"below range", 0.5, 1, 12, nil},
		{"above range", 500.5, 1, 500, nil},
		{"string is not a number", "5", 0, 10, nil},
		{"bool is not a number", true, 0, 10, nil},
		{"nil is not a number", nil, 0, 10, nil},
		{"NaN rejected", math.NaN(), 0, 10, nil},
		{"+Inf rejected", math.Inf(1), 0, math.Inf(1), nil},
		{"-Inf rejected", math.Inf(-1), -math.Inf(1), 0, nil},
		// Math.round semantics: floor(x*100+0.5)/100, half toward +∞.
		{"rounds 2.005 up (fp quirk)", 2.005, 0, 10, new(2.01)}, // 2.005*100 → exactly 200.5 in doubles
		{"rounds 2.51 up", 0.0255, 0, 1, new(0.03)},
		{"negative half toward +inf", -0.125, -1, 1, new(-0.12)},
		{"two decimals kept", 7.456, 0, 10, new(7.46)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Num(tc.v, tc.lo, tc.hi)
			if tc.want == nil {
				if got != nil {
					t.Fatalf("Num(%v,%v,%v) = %v, want nil", tc.v, tc.lo, tc.hi, *got)
				}
				return
			}
			if got == nil || *got != *tc.want {
				t.Fatalf("Num(%v,%v,%v) = %v, want %v", tc.v, tc.lo, tc.hi, got, *tc.want)
			}
		})
	}
}

func TestCleanEntry(t *testing.T) {
	t.Run("nil and non-objects rejected", func(t *testing.T) {
		for _, v := range []any{nil, "x", 42, true, []any{}} {
			if CleanEntry(v) != nil {
				t.Fatalf("CleanEntry(%#v) should be nil", v)
			}
		}
	})
	t.Run("id rules", func(t *testing.T) {
		if CleanEntry(map[string]any{}) != nil {
			t.Fatal("missing id must reject")
		}
		if CleanEntry(map[string]any{"id": "   "}) != nil {
			t.Fatal("blank id must reject")
		}
		if CleanEntry(map[string]any{"id": strings.Repeat("a", 41)}) != nil {
			t.Fatal("id > 40 chars must reject")
		}
		e := CleanEntry(map[string]any{"id": strings.Repeat("a", 40)})
		if e == nil || e.ID != strings.Repeat("a", 40) {
			t.Fatal("id of exactly 40 chars must pass")
		}
	})
	t.Run("full entry", func(t *testing.T) {
		e := CleanEntry(map[string]any{
			"id": " bench ", "sets": 5, "reps": 8, "weight": 62.5,
			"sec": 90, "min": 30, "speed": 10.5, "mode": "time",
			"bodyweight": true, "side": true, "prog": "linear", "inc": 2.5,
			"repsMin": 6, "repsMax": 10,
		})
		want := &Entry{
			ID: "bench", Mode: "time", Bodyweight: true, Side: true, Prog: "linear",
			Sets: new(5.0), Reps: new(8.0), Weight: new(62.5), Sec: new(90.0),
			Min: new(30.0), Speed: new(10.5), Inc: new(2.5), RepsMin: new(6.0),
			RepsMax: new(10.0),
		}
		if !reflect.DeepEqual(e, want) {
			t.Fatalf("got %#v\nwant %#v", e, want)
		}
	})
	t.Run("invalid fields are dropped, not fatal", func(t *testing.T) {
		e := CleanEntry(map[string]any{
			"id": "x", "sets": "many", "weight": -5, "reps": 9999,
			"mode": "both", "prog": "chaos", "bodyweight": false, "unknown": "field",
		})
		want := &Entry{ID: "x"}
		if !reflect.DeepEqual(e, want) {
			t.Fatalf("got %#v, want %#v", e, want)
		}
	})
}

func TestCleanRoutine(t *testing.T) {
	t.Run("name required", func(t *testing.T) {
		if CleanRoutine(map[string]any{"id": "a"}) != nil {
			t.Fatal("missing name must reject")
		}
	})
	t.Run("id stripped to word chars", func(t *testing.T) {
		r := CleanRoutine(map[string]any{"name": "Day A", "id": "day A!@#$"})
		if r == nil || r.ID != "dayA" {
			t.Fatalf("got %#v", r)
		}
	})
	t.Run("id only symbols rejects", func(t *testing.T) {
		if CleanRoutine(map[string]any{"name": "X", "id": "***"}) != nil {
			t.Fatal("empty-after-strip id must reject")
		}
	})
	t.Run("caps and exercise list", func(t *testing.T) {
		ex := []any{}
		for i := range 35 {
			ex = append(ex, map[string]any{"id": "ex", "sets": i + 1})
		}
		ex = append(ex, "junk", nil)
		r := CleanRoutine(map[string]any{
			"name": strings.Repeat("n", 70), "id": strings.Repeat("d", 50),
			"emoji": strings.Repeat("e", 30), "ex": ex, "prog": "greyskull",
		})
		if r == nil {
			t.Fatal("expected routine")
		}
		if len(r.Name) != 60 || len(r.ID) != 40 || len(r.Emoji) != 24 {
			t.Fatalf("caps wrong: name=%d id=%d emoji=%d", len(r.Name), len(r.ID), len(r.Emoji))
		}
		if len(r.Ex) != 30 || r.Ex[0].ID != "ex" || r.Prog != "greyskull" {
			t.Fatalf("ex/prog wrong: %+v", r)
		}
	})
	t.Run("non-array ex becomes empty slice", func(t *testing.T) {
		r := CleanRoutine(map[string]any{"name": "N", "id": "n", "ex": "nope"})
		if r == nil || r.Ex == nil || len(r.Ex) != 0 {
			t.Fatalf("got %#v", r)
		}
	})
}

func TestCleanSuggestion(t *testing.T) {
	t.Run("silent entry dropped", func(t *testing.T) {
		if CleanSuggestion(map[string]any{"id": "x"}) != nil {
			t.Fatal("entry with nothing to say must be nil")
		}
	})
	t.Run("only allow-listed fields survive", func(t *testing.T) {
		s := CleanSuggestion(map[string]any{
			"id": "x", "sets": 3, "inc": 5, "bodyweight": true,
			"swapTo": "  rows  ", "note": strings.Repeat("o", 300),
		})
		want := &Suggestion{ID: "x", Sets: new(3.0), SwapTo: "rows", Note: strings.Repeat("o", 240)}
		if !reflect.DeepEqual(s, want) {
			t.Fatalf("got %#v\nwant %#v", s, want)
		}
	})
	t.Run("long swapTo dropped entirely", func(t *testing.T) {
		s := CleanSuggestion(map[string]any{"id": "x", "swapTo": strings.Repeat("s", 41)})
		if s != nil {
			t.Fatalf("want nil, got %#v", s)
		}
	})
	t.Run("bad base entry rejected", func(t *testing.T) {
		if CleanSuggestion(nil) != nil || CleanSuggestion(map[string]any{"note": "hi"}) != nil {
			t.Fatal("must require a valid cleaned entry")
		}
	})
}

func TestUTF16Semantics(t *testing.T) {
	// U+1F3CB U+FE0F ("🏋️") is 3 UTF-16 units: 20 of them = 60 units fits a
	// 40-unit cap check at exactly 60… so use them against the 40 cap.
	emoji := strings.Repeat("🏋️", 13) // 39 units
	if e := CleanEntry(map[string]any{"id": emoji}); e == nil {
		t.Fatal("39-unit id must be accepted")
	}
	if e := CleanEntry(map[string]any{"id": emoji + "🏋"}); e != nil { // +2 = 41
		t.Fatal("41-unit id must be rejected")
	}
	// Slicing never splits a surrogate pair / rune.
	s := jsSlice(strings.Repeat("🏋️", 21), 61) // cut after 60 units
	if got := jsLen(s); got != 60 {
		t.Fatalf("slice produced %d units, want 60", got)
	}
}
