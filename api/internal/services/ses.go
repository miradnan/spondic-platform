package services

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

// SESClient wraps the AWS SES v2 SDK for sending emails.
type SESClient struct {
	client    *sesv2.Client
	fromEmail string
}

// NewSESClient creates an SES v2 client configured for the given region.
func NewSESClient(region, fromEmail string) (*SESClient, error) {
	ctx := context.Background()
	cfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	return &SESClient{
		client:    sesv2.NewFromConfig(cfg),
		fromEmail: fromEmail,
	}, nil
}

// SendEmail sends an HTML email via SES v2.
func (s *SESClient) SendEmail(ctx context.Context, to, subject, htmlBody string) error {
	input := &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(s.fromEmail),
		Destination: &types.Destination{
			ToAddresses: []string{to},
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data:    aws.String(subject),
					Charset: aws.String("UTF-8"),
				},
				Body: &types.Body{
					Html: &types.Content{
						Data:    aws.String(htmlBody),
						Charset: aws.String("UTF-8"),
					},
				},
			},
		},
	}

	_, err := s.client.SendEmail(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to send email via SES: %w", err)
	}
	return nil
}
