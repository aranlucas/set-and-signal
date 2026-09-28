package main

import railway "github.com/railwayapp/railway-go-sdk"

const publicDomain = "opengym2.up.railway.app"
const publicOrigin = "https://" + publicDomain

func Railway() railway.Project {
	// Keep the existing Railway address so adopting this file never replaces the
	// SQLite volume. The user-facing project and application identity is Set & Signal.
	data := railway.Volume("opengym2-demo-volume", map[string]any{
		"region":            "us-west2",
		"sizeMB":            5_000,
		"allowOnlineResize": true,
		"alerts": map[string]any{
			"usage": map[string]any{
				"80":  map[string]any{},
				"95":  map[string]any{},
				"100": map[string]any{},
			},
		},
	})

	app := railway.ServiceNamed("opengym2-demo", railway.ServiceConfig{
		"source": railway.Github("aranlucas/set-and-signal", map[string]any{"branch": "main"}),
		"build": map[string]any{
			"builder":          "DOCKERFILE",
			"dockerfilePath":   "Dockerfile",
			"buildEnvironment": "V3",
		},
		"deploy": map[string]any{
			"runtime":                 "V2",
			"healthcheckPath":         "/api/health",
			"healthcheckTimeout":      100,
			"sleepApplication":        true,
			"restartPolicyMaxRetries": 3,
			"multiRegionConfig": map[string]any{
				"us-west2": map[string]any{"numReplicas": 1},
			},
			"limitOverride": map[string]any{
				"containers": map[string]any{
					"cpu":         0.5,
					"memoryBytes": 500_000_000,
				},
			},
			"ipv6EgressEnabled": false,
			"useLegacyStacker":  false,
		},
		"env": map[string]any{
			"DATA_DIR":           "/data",
			"CONVEX_URL":         "https://cheerful-peacock-198.convex.cloud",
			"OPENROUTER_API_KEY": railway.Preserve(),
			"OPENROUTER_MODEL":   "openrouter/free",
			"ORIGIN":             publicOrigin,
			"PUBLIC_URL":         publicOrigin,
			"RP_ID":              publicDomain,
			"RP_NAME":            "Set & Signal",
		},
		"volumeMounts": map[string]any{
			"/data": data,
		},
	})

	return railway.ProjectNamed("Set & Signal", []any{app, data})
}
