package services

import (
	"fmt"
	"time"

	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/customer"
	"github.com/stripe/stripe-go/v81/usagerecord"
	"github.com/stripe/stripe-go/v81/webhook"
)

// StripeClient wraps the Stripe SDK for billing operations.
type StripeClient struct {
	secretKey     string
	webhookSecret string
	priceIDs      map[string]string
}

// NewStripeClient creates a new Stripe client and sets the global API key.
// priceIDs maps plan names ("starter", "growth", "enterprise") to Stripe Price IDs.
func NewStripeClient(secretKey, webhookSecret string, priceIDs map[string]string) *StripeClient {
	stripe.Key = secretKey
	return &StripeClient{
		secretKey:     secretKey,
		webhookSecret: webhookSecret,
		priceIDs:      priceIDs,
	}
}

// CreateCustomer creates a Stripe customer for an organization.
// Returns the Stripe customer ID.
func (s *StripeClient) CreateCustomer(orgID, email string) (string, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
	}
	params.AddMetadata("organization_id", orgID)

	c, err := customer.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create Stripe customer: %w", err)
	}
	return c.ID, nil
}

// CreateCheckoutSession creates a Stripe Checkout session for subscription purchase.
// Returns the checkout session URL.
func (s *StripeClient) CreateCheckoutSession(customerID, plan, successURL, cancelURL string) (string, error) {
	priceID, ok := s.priceIDs[plan]
	if !ok {
		return "", fmt.Errorf("unknown plan: %s", plan)
	}

	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
	}

	sess, err := checkoutsession.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create checkout session: %w", err)
	}
	return sess.URL, nil
}

// CreatePortalSession creates a Stripe Billing Portal session for subscription management.
// Returns the portal session URL.
func (s *StripeClient) CreatePortalSession(customerID, returnURL string) (string, error) {
	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(returnURL),
	}

	sess, err := session.New(params)
	if err != nil {
		return "", fmt.Errorf("failed to create portal session: %w", err)
	}
	return sess.URL, nil
}

// ReportMeteredUsage reports token overage usage to a Stripe metered subscription item.
// subscriptionItemID is the Stripe subscription item with metered pricing.
// quantity is the number of units (e.g., thousands of tokens).
func (s *StripeClient) ReportMeteredUsage(subscriptionItemID string, quantity int64) error {
	params := &stripe.UsageRecordParams{
		SubscriptionItem: stripe.String(subscriptionItemID),
		Quantity:         stripe.Int64(quantity),
		Timestamp:        stripe.Int64(time.Now().Unix()),
		Action:           stripe.String(string(stripe.UsageRecordActionIncrement)),
	}

	_, err := usagerecord.New(params)
	if err != nil {
		return fmt.Errorf("failed to report metered usage: %w", err)
	}
	return nil
}

// ConstructWebhookEvent verifies and parses a Stripe webhook event from the raw payload and signature.
func (s *StripeClient) ConstructWebhookEvent(payload []byte, signature string) (stripe.Event, error) {
	event, err := webhook.ConstructEvent(payload, signature, s.webhookSecret)
	if err != nil {
		return stripe.Event{}, fmt.Errorf("failed to verify webhook signature: %w", err)
	}
	return event, nil
}
