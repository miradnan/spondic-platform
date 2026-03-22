package config

import "os"

// Config holds all environment-driven configuration for the API service.
type Config struct {
	Port               string
	DatabaseURL        string
	CORSOrigins        string
	ClerkJWKSURL       string
	AWSRegion          string
	AWSS3Bucket        string
	AIServiceURL       string
	StripeSecretKey    string
	StripeWebhookSecret string
	SESFromEmail       string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://spondic:spondic@localhost:5432/spondic?sslmode=disable"),
		CORSOrigins:  getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"),
		ClerkJWKSURL: getEnv("CLERK_JWKS_URL", ""),
		AWSRegion:    getEnv("AWS_REGION", "us-east-1"),
		AWSS3Bucket:  getEnv("AWS_S3_BUCKET", ""),
		AIServiceURL:       getEnv("AI_SERVICE_URL", "http://localhost:8000"),
		StripeSecretKey:    getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
		SESFromEmail:       getEnv("SES_FROM_EMAIL", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
