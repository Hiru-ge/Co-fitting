package routes

import (
	"testing"

	"github.com/Hiru-ge/roamble/handlers"
	"github.com/gin-gonic/gin"
)

func hasRoute(routes gin.RoutesInfo, method, path string) bool {
	for _, r := range routes {
		if r.Method == method && r.Path == path {
			return true
		}
	}
	return false
}

func baseDeps(environment string) Deps {
	return Deps{
		AuthHandler:       &handlers.AuthHandler{},
		OAuthHandler:      &handlers.OAuthHandler{},
		UserHandler:       &handlers.UserHandler{},
		BadgeHandler:      &handlers.BadgeHandler{},
		GenreHandler:      &handlers.GenreHandler{},
		VisitHandler:      &handlers.VisitHandler{},
		SuggestionHandler: &handlers.SuggestionHandler{},
		PlacePhotoHandler: &handlers.PlacePhotoHandler{},
		HealthHandler:     &handlers.HealthHandler{},
		DevHandler:        &handlers.DevHandler{},
		BetaHandler:       &handlers.BetaHandler{},
		NotificationHandler: &handlers.NotificationHandler{
			VAPIDPublicKey: "test-key",
		},
		JWTSecret:      "test-secret",
		AllowedOrigins: []string{"http://localhost:5173"},
		Environment:    environment,
	}
}

func TestSetup_DevelopmentIncludesDevRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	Setup(r, baseDeps("development"))
	routes := r.Routes()

	if !hasRoute(routes, "POST", "/api/dev/auth/test-login") {
		t.Fatal("expected dev public test-login route")
	}
	if !hasRoute(routes, "DELETE", "/api/dev/suggestions/cache") {
		t.Fatal("expected dev cache clear route")
	}
	if !hasRoute(routes, "POST", "/api/dev/notifications/trigger") {
		t.Fatal("expected dev trigger route")
	}
}

func TestSetup_ProductionExcludesDevRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	Setup(r, baseDeps("production"))
	routes := r.Routes()

	if hasRoute(routes, "POST", "/api/dev/auth/test-login") {
		t.Fatal("did not expect dev public route in production")
	}
	if hasRoute(routes, "DELETE", "/api/dev/suggestions/cache") {
		t.Fatal("did not expect dev protected route in production")
	}
}

func TestSetup_OptionalHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	deps := baseDeps("development")
	deps.NotificationHandler = nil
	deps.SuggestionHandler = nil
	deps.PlacePhotoHandler = nil

	Setup(r, deps)
	routes := r.Routes()

	if hasRoute(routes, "GET", "/api/notifications/push/vapid-key") {
		t.Fatal("notification public route should not be registered when handler is nil")
	}
	if hasRoute(routes, "POST", "/api/suggestions") {
		t.Fatal("suggestions route should not be registered when handler is nil")
	}
	if hasRoute(routes, "GET", "/api/places/:placeId/photo") {
		t.Fatal("place photo route should not be registered when handler is nil")
	}
}

func TestSetup_AuthBoundaryRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	Setup(r, baseDeps("development"))
	routes := r.Routes()

	checks := []struct {
		method string
		path   string
	}{
		{"POST", "/api/auth/refresh"},
		{"POST", "/api/auth/oauth/google"},
		{"POST", "/api/auth/logout"},
		{"GET", "/api/users/me"},
		{"GET", "/api/genres"},
		{"POST", "/api/visits"},
	}

	for _, c := range checks {
		if !hasRoute(routes, c.method, c.path) {
			t.Fatalf("expected route %s %s", c.method, c.path)
		}
	}
}
