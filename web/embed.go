// Package web exposes the committed frontend build tree as an embed.FS so
// cmd/opengym-api can serve it. Only dist/.gitkeep is committed — the build
// always compiles even before a frontend build is dropped in; WEB_DIST can
// override this embedded copy with a filesystem directory.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// Dist returns the dist subtree rooted at its own root (so "index.html" is
// the name of the SPA entrypoint).
func Dist() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic("web: dist missing from embedded tree: " + err.Error())
	}
	return sub
}
