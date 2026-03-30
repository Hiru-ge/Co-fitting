package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const Issuer = "roamble"

type Claims struct {
	UserID    uint64 `json:"user_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func generateToken(userID uint64, secret, tokenType string, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    userID,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func GenerateAccessToken(userID uint64, secret string, expiry time.Duration) (string, error) {
	return generateToken(userID, secret, "access", expiry)
}

func GenerateRefreshToken(userID uint64, secret string, expiry time.Duration) (string, error) {
	return generateToken(userID, secret, "refresh", expiry)
}

func GenerateTokenPair(userID uint64, secret string, accessExpiry, refreshExpiry time.Duration) (*TokenPair, error) {
	accessToken, err := GenerateAccessToken(userID, secret, accessExpiry)
	if err != nil {
		return nil, err
	}

	refreshToken, err := GenerateRefreshToken(userID, secret, refreshExpiry)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func ValidateToken(tokenString, secret string) (*Claims, error) {
	if tokenString == "" {
		return nil, errors.New("token is empty")
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
