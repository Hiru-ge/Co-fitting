package utils

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-key"

func TestGenerateTokenPair(t *testing.T) {
	pair, err := GenerateTokenPair(1, testSecret, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pair.AccessToken == "" {
		t.Error("access token should not be empty")
	}
	if pair.RefreshToken == "" {
		t.Error("refresh token should not be empty")
	}
	if pair.AccessToken == pair.RefreshToken {
		t.Error("access and refresh tokens should be different")
	}
}

func TestGenerateAccessToken(t *testing.T) {
	token, err := GenerateAccessToken(42, testSecret, 15*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("token should not be empty")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	token, err := GenerateRefreshToken(42, testSecret, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Error("token should not be empty")
	}
}

func TestValidateToken_ValidAccessToken(t *testing.T) {
	token, _ := GenerateAccessToken(42, testSecret, 15*time.Minute)

	claims, err := ValidateToken(token, testSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("expected UserID 42, got %d", claims.UserID)
	}
	if claims.TokenType != "access" {
		t.Errorf("expected token type 'access', got '%s'", claims.TokenType)
	}
	if claims.Issuer != "roamble" {
		t.Errorf("expected issuer 'roamble', got '%s'", claims.Issuer)
	}
}

func TestValidateToken_ValidRefreshToken(t *testing.T) {
	token, _ := GenerateRefreshToken(42, testSecret, 7*24*time.Hour)

	claims, err := ValidateToken(token, testSecret)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("expected UserID 42, got %d", claims.UserID)
	}
	if claims.TokenType != "refresh" {
		t.Errorf("expected token type 'refresh', got '%s'", claims.TokenType)
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	token, _ := GenerateAccessToken(42, testSecret, -1*time.Minute)

	_, err := ValidateToken(token, testSecret)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestValidateToken_WrongSecret(t *testing.T) {
	token, _ := GenerateAccessToken(42, testSecret, 15*time.Minute)

	_, err := ValidateToken(token, "wrong-secret")
	if err == nil {
		t.Fatal("expected error for wrong secret")
	}
}

func TestValidateToken_InvalidFormat(t *testing.T) {
	_, err := ValidateToken("not.a.valid.jwt", testSecret)
	if err == nil {
		t.Fatal("expected error for invalid token format")
	}
}

func TestValidateToken_EmptyToken(t *testing.T) {
	_, err := ValidateToken("", testSecret)
	if err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestValidateToken_WrongSigningMethod(t *testing.T) {
	// トークンをnoneアルゴリズムで署名（攻撃パターン）
	claims := jwt.MapClaims{
		"user_id":    42,
		"token_type": "access",
		"iss":        "roamble",
		"exp":        time.Now().Add(15 * time.Minute).Unix(),
		"iat":        time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	_, err := ValidateToken(tokenString, testSecret)
	if err == nil {
		t.Fatal("expected error for none signing method")
	}
}
