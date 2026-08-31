package exercises

import "testing"

func TestSearchBenchPress(t *testing.T) {
	hits := Search("bench press barbell", nil, SearchFilters{Limit: 5})
	if len(hits) == 0 {
		t.Fatal("no hits")
	}
	found := false
	for _, h := range hits {
		if h.ID != "" && h.N != "" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("bad hits: %v", hits)
	}
}

func TestLookupAndNameOf(t *testing.T) {
	e, ok := Lookup("0001")
	if !ok || e.N == "" {
		t.Fatalf("lookup 0001 = %v %v", e, ok)
	}
	if NameOf("0001", nil) != e.N {
		t.Fatalf("NameOf catalog")
	}
	custom := []any{map[string]any{"id": "cx1", "n": "My Lift"}}
	if NameOf("cx1", custom) != "My Lift" {
		t.Fatal("custom name")
	}
}
