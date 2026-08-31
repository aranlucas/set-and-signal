// Command opengym-import migrates a legacy Node openGym data dir (db.json +
// state-<uid>.json blobs, see api/server.js lines 37–58) into the SQLite
// database. Every record is upserted with its original ids, counters, token
// hashes, sv/disabled/admin flags and invite state preserved, so the importer
// is safe to re-run.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	dataDir := flag.String("data", "", "legacy data dir containing db.json and state-*.json (required)")
	dbPath := flag.String("db", "", "target SQLite database path (default $DB_PATH, else <data>/opengym.db)")
	flag.Parse()

	if *dataDir == "" {
		flag.Usage()
		os.Exit(2)
	}
	if *dbPath == "" {
		if v := os.Getenv("DB_PATH"); v != "" {
			*dbPath = v
		} else {
			*dbPath = filepath.Join(*dataDir, "opengym.db")
		}
	}

	counts, err := importData(*dataDir, *dbPath)
	fmt.Printf("imported: %s -> %s\n", counts, *dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "import finished with failures:\n%v\n", err)
		os.Exit(1)
	}
}
