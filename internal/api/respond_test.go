package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteJSONUsesV2CollectionDefaults(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeJSON(recorder, http.StatusOK, struct {
		Items []string          `json:"items"`
		Meta  map[string]string `json:"meta"`
	}{})

	if got, want := recorder.Body.String(), `{"items":[],"meta":{}}`; got != want {
		t.Fatalf("writeJSON body = %s, want %s", got, want)
	}
}

func TestReadJSONUsesV2StrictSyntax(t *testing.T) {
	oversized := append([]byte(`{"name":"`), bytes.Repeat([]byte("a"), maxBody)...)
	oversized = append(oversized, '"', '}')
	tests := []struct {
		name       string
		body       []byte
		wantStatus int
	}{
		{name: "duplicate object name", body: []byte(`{"name":"first","name":"second"}`), wantStatus: http.StatusBadRequest},
		{name: "multiple values", body: []byte(`{"name":"first"} {"name":"second"}`), wantStatus: http.StatusBadRequest},
		{name: "invalid UTF-8", body: append([]byte(`{"name":"`), 0xff, '"', '}'), wantStatus: http.StatusBadRequest},
		{name: "unknown member", body: []byte(`{"extra":true}`), wantStatus: http.StatusBadRequest},
		{name: "mismatched field case", body: []byte(`{"Name":"workset"}`), wantStatus: http.StatusBadRequest},
		{name: "empty body", wantStatus: http.StatusBadRequest},
		{name: "oversized body", body: oversized, wantStatus: http.StatusRequestEntityTooLarge},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(test.body))
			recorder := httptest.NewRecorder()
			var dst struct {
				Name string `json:"name"`
			}

			if readJSON(recorder, request, &dst) {
				t.Fatal("readJSON accepted invalid JSON")
			}
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantStatus)
			}
			wantError := `"error":"bad json"`
			if test.wantStatus == http.StatusRequestEntityTooLarge {
				wantError = `"error":"body too large"`
			}
			if !strings.Contains(recorder.Body.String(), wantError) {
				t.Fatalf("body = %s", recorder.Body.String())
			}
		})
	}
}
