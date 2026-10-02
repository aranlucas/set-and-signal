// Package validation configures the shared struct-tag validator for typed inputs.
package validation

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// A single validator caches the request schemas and is safe to reuse across requests.
var Validator = func() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
		return name
	})
	return v
}()
