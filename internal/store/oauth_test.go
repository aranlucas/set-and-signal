package store

import (
	"strconv"
	"sync"
	"testing"
)

func TestFindOrCreateOIDCUserIsAtomic(t *testing.T) {
	st := openTest(t)

	const attempts = 16
	ids := make(chan string, attempts)
	errs := make(chan error, attempts)
	var wg sync.WaitGroup
	for range attempts {
		wg.Go(func() {
			u, err := st.FindOrCreateOIDCUser("google", "subject-1", "person@example.com", "Person")
			if err != nil {
				errs <- err
				return
			}
			ids <- u.ID
		})
	}
	wg.Wait()
	close(errs)
	close(ids)
	for err := range errs {
		t.Fatalf("FindOrCreateOIDCUser: %v", err)
	}

	var first string
	for id := range ids {
		if first == "" {
			first = id
		} else if id != first {
			t.Fatalf("concurrent callbacks returned different users: %q and %q", first, id)
		}
	}
	if first == "" {
		t.Fatal("no user returned")
	}

	var users, identities int
	if err := st.DB.QueryRow(`SELECT count(*) FROM users`).Scan(&users); err != nil {
		t.Fatal(err)
	}
	if err := st.DB.QueryRow(`SELECT count(*) FROM oidc_identities`).Scan(&identities); err != nil {
		t.Fatal(err)
	}
	if users != 1 || identities != 1 {
		t.Fatalf("users=%d identities=%d, want exactly one of each", users, identities)
	}
}

func TestOAuthClientByIDRejectsCorruptJSON(t *testing.T) {
	st := openTest(t)
	if err := st.SaveOAuthClient(OAuthClient{
		ClientID:     "client-1",
		RedirectURIs: []string{"https://client.example/callback"},
		GrantTypes:   []string{"authorization_code"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := st.DB.Exec(`UPDATE oauth_clients SET redirect_uris = 'not-json' WHERE client_id = 'client-1'`); err != nil {
		t.Fatal(err)
	}
	if client, err := st.OAuthClientByID("client-1"); err == nil || client != nil {
		t.Fatalf("OAuthClientByID = (%+v, %v), want nil and a corruption error", client, err)
	}
}

func TestCleanExpiredOAuthRows(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}
	if err := st.SaveOAuthClient(OAuthClient{ClientID: "client-1"}); err != nil {
		t.Fatal(err)
	}

	for _, exp := range []int64{99, 100, 101} {
		if err := st.SaveOAuthCode(OAuthCode{
			CodeHash: "code-" + strconv.FormatInt(exp, 10), ClientID: "client-1", UserID: "u1", Exp: exp,
		}); err != nil {
			t.Fatal(err)
		}
		if err := st.SaveOAuthRefresh(OAuthRefresh{
			TokenHash: "refresh-" + strconv.FormatInt(exp, 10), ClientID: "client-1", UserID: "u1", Exp: exp,
		}); err != nil {
			t.Fatal(err)
		}
	}
	if err := st.CleanExpiredOAuthCodes(100); err != nil {
		t.Fatal(err)
	}
	if err := st.CleanExpiredOAuthRefresh(100); err != nil {
		t.Fatal(err)
	}

	for _, table := range []string{"oauth_codes", "oauth_refresh"} {
		var count int
		if err := st.DB.QueryRow(`SELECT count(*) FROM ` + table).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 2 {
			t.Fatalf("%s count=%d, want rows at and after the cutoff to remain", table, count)
		}
	}
}
