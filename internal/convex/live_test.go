package convex

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"os"
	"testing"
	"time"
)

// Opt-in smoke test against a development deployment with synthetic records only.
func TestLiveDevelopment(t *testing.T) {
	url := os.Getenv("CONVEX_TEST_URL")
	if url == "" {
		t.Skip("CONVEX_TEST_URL not set")
	}
	c, err := New(url, "http://localhost:3000", os.Getenv("CONVEX_TEST_KEY_DIR"))
	if err != nil {
		t.Fatal(err)
	}
	uid := fmt.Sprintf("integration-test-%d", time.Now().UnixNano())
	if err := c.Import(uid, jsontext.Value(`{"unit":"lb","restSec":60,"workouts":[]}`)); err != nil {
		t.Fatal(err)
	}
	if err := c.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		var value map[string]any
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		value["restSec"] = 90
		return json.Marshal(value)
	}); err != nil {
		t.Fatal(err)
	}
	raw, err := c.ReadState(uid)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatal(err)
	}
	if value["restSec"] != float64(90) || value["unit"] != "lb" {
		t.Fatalf("unexpected state %s", raw)
	}
	summary, err := c.Summary(uid)
	if err != nil {
		t.Fatal(err)
	}
	if summary.Workouts != 0 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	other, err := c.ReadState(uid + "-other")
	if err != nil || string(other) != "null" {
		t.Fatalf("isolation failed: %s %v", other, err)
	}
}
