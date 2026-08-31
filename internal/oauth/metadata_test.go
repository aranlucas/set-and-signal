package oauth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONHandlesMarshalFailureBeforeWritingHeaders(t *testing.T) {
	recorder := httptest.NewRecorder()
	writeJSON(recorder, http.StatusCreated, make(chan int))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
	if got, want := recorder.Body.String(), `{"error":"server_error","error_description":"server error"}`; got != want {
		t.Fatalf("body = %s, want %s", got, want)
	}
	if got := recorder.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q", got)
	}
}
