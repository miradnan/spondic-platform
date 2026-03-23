package config

import "os"

// Config holds all environment-driven configuration for the API service.
type Config struct {
	Port               string
	DatabaseURL        string
	CORSOrigins        string
	ClerkJWKSURL       string
	ClerkSecretKey     string
	AWSRegion          string
	AWSS3Bucket        string
	AIServiceURL       string
	StripeSecretKey       string
	StripeWebhookSecret   string
	StripePriceStarter    string
	StripePriceGrowth     string
	StripePriceEnterprise string
	SESRegion          string
	SESFromEmail       string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://spondic:spondic@localhost:5432/spondic?sslmode=disable"),
		CORSOrigins:  getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"),
		ClerkJWKSURL:   getEnv("CLERK_JWKS_URL", ""),
		ClerkSecretKey: getEnv("CLERK_SECRET_KEY", ""),
		AWSRegion:      getEnv("AWS_REGION", "us-east-1"),
		AWSS3Bucket:  getEnv("AWS_S3_BUCKET", ""),
		AIServiceURL:       getEnv("AI_SERVICE_URL", "http://localhost:8000"),
		StripeSecretKey:       getEnv("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret:   getEnv("STRIPE_WEBHOOK_SECRET", ""),
		StripePriceStarter:    getEnv("STRIPE_PRICE_STARTER", ""),
		StripePriceGrowth:     getEnv("STRIPE_PRICE_GROWTH", ""),
		StripePriceEnterprise: getEnv("STRIPE_PRICE_ENTERPRISE", ""),
		SESRegion:          getEnv("SES_AWS_REGION", "ap-south-1"),
		SESFromEmail:       getEnv("SES_FROM_EMAIL", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
