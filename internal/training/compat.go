package training

import "regexp"

var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func utf16Len(r rune) int {
	if r >= 0x10000 {
		return 2
	}
	return 1
}

// jsSlice preserves the legacy JavaScript slice limit used by persisted data.
func jsSlice(value string, limit int) string {
	width := 0
	for index, character := range value {
		if width+utf16Len(character) > limit {
			return value[:index]
		}
		width += utf16Len(character)
	}
	return value
}
