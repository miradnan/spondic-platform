package handlers

// Routes to register in main.go:
// api.GET("/plan", h.GetPlan)
// api.POST("/billing/checkout", h.CreateCheckout)
// api.PUT("/billing/subscription", h.UpdateSubscription)
// api.POST("/billing/portal", h.CreatePortalSession)
// api.GET("/billing/subscription", h.GetSubscription)
// api.GET("/billing/usage", h.GetUsage)
// api.GET("/billing/token-usage", h.GetTokenUsage)
// api.GET("/billing/invoices", h.GetInvoices)
// e.POST("/billing/webhook", h.HandleWebhook)  // NO auth middleware

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stripe/stripe-go/v81"

	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/models"
	"github.com/spondic/api/internal/services"
)

// validPlans defines the allowed subscription plans.
var validPlans = map[string]bool{
	"starter":    true,
	"growth":     true,
	"enterprise": true,
}

// stripeClient is the package-level Stripe client used by billing handlers.
// Set via SetStripeClient before registering billing routes.
var stripeClient *services.StripeClient

// SetStripeClient configures the Stripe client for billing handlers.
// Call this from main.go after creating the StripeClient.
func SetStripeClient(sc *services.StripeClient) {
	stripeClient = sc
}

// GetPlan handles GET /api/plan — returns the current org's plan and limits from the JWT claim.
func (h *Handler) GetPlan(c echo.Context) error {
	plan := middleware.GetPlan(c)
	limits := middleware.GetPlanLimits(c)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"plan":   plan,
		"limits": limits,
	})
}

// CreateCheckout handles POST /api/billing/checkout — creates a Stripe checkout session for new subscriptions.
func (h *Handler) CreateCheckout(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Plan       string `json:"plan"`
		SuccessURL string `json:"success_url"`
		CancelURL  string `json:"cancel_url"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if !validPlans[body.Plan] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid plan, must be one of: starter, growth, enterprise"})
	}
	if body.SuccessURL == "" || body.CancelURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "success_url and cancel_url are required"})
	}

	if stripeClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "billing service not configured"})
	}

	ctx := context.Background()

	// Check if org already has a subscription
	var sub models.Subscription
	err := h.DB.QueryRowContext(ctx,
		`SELECT id, organization_id, stripe_customer_id, stripe_subscription_id,
		        stripe_subscription_item_id, plan, status,
		        current_period_start, current_period_end, cancel_at, canceled_at, created_at, updated_at
		 FROM subscriptions WHERE organization_id = $1`,
		orgID,
	).Scan(
		&sub.ID, &sub.OrganizationID, &sub.StripeCustomerID, &sub.StripeSubscriptionID,
		&sub.StripeSubscriptionItemID, &sub.Plan, &sub.Status, &sub.CurrentPeriodStart,
		&sub.CurrentPeriodEnd, &sub.CancelAt, &sub.CanceledAt, &sub.CreatedAt, &sub.UpdatedAt,
	)

	var customerID string

	if err == sql.ErrNoRows {
		// No subscription exists — create a Stripe customer first
		userID := getUserID(c)
		newCustomerID, createErr := stripeClient.CreateCustomer(orgID, userID+"@spondic.app")
		if createErr != nil {
			log.Printf("error creating Stripe customer: %v", createErr)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create billing customer"})
		}
		customerID = newCustomerID

		// Insert subscription row with status='incomplete'
		_, insertErr := h.DB.ExecContext(ctx,
			`INSERT INTO subscriptions (organization_id, stripe_customer_id, plan, status)
			 VALUES ($1, $2, $3, 'incomplete')`,
			orgID, customerID, body.Plan,
		)
		if insertErr != nil {
			log.Printf("error inserting subscription: %v", insertErr)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	} else if err != nil {
		log.Printf("error querying subscription: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	} else if sub.StripeCustomerID == "" {
		// Subscription exists but has no Stripe customer (auto-created by middleware)
		userID := getUserID(c)
		newCustomerID, createErr := stripeClient.CreateCustomer(orgID, userID+"@spondic.app")
		if createErr != nil {
			log.Printf("error creating Stripe customer: %v", createErr)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create billing customer"})
		}
		customerID = newCustomerID

		_, updateErr := h.DB.ExecContext(ctx,
			`UPDATE subscriptions SET stripe_customer_id = $1, plan = $2, status = 'incomplete', updated_at = NOW()
			 WHERE organization_id = $3`,
			customerID, body.Plan, orgID,
		)
		if updateErr != nil {
			log.Printf("error updating subscription with customer ID: %v", updateErr)
		}
	} else {
		customerID = sub.StripeCustomerID
	}

	// Create checkout session
	checkoutURL, err := stripeClient.CreateCheckoutSession(customerID, body.Plan, body.SuccessURL, body.CancelURL)
	if err != nil {
		log.Printf("error creating checkout session for org=%s plan=%s customer=%s: %v", orgID, body.Plan, customerID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create checkout session"})
	}

	return c.JSON(http.StatusOK, map[string]string{"checkout_url": checkoutURL})
}

// UpdateSubscription handles PUT /api/billing/subscription — change plan for existing subscribers.
func (h *Handler) UpdateSubscription(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		Plan string `json:"plan"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if !validPlans[body.Plan] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid plan, must be one of: starter, growth, enterprise"})
	}

	if stripeClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "billing service not configured"})
	}

	ctx := context.Background()

	// Look up current subscription
	var sub models.Subscription
	err := h.DB.QueryRowContext(ctx,
		`SELECT id, organization_id, stripe_customer_id, stripe_subscription_id,
		        stripe_subscription_item_id, plan, status,
		        current_period_start, current_period_end, cancel_at, canceled_at, created_at, updated_at
		 FROM subscriptions WHERE organization_id = $1`,
		orgID,
	).Scan(
		&sub.ID, &sub.OrganizationID, &sub.StripeCustomerID, &sub.StripeSubscriptionID,
		&sub.StripeSubscriptionItemID, &sub.Plan, &sub.Status, &sub.CurrentPeriodStart,
		&sub.CurrentPeriodEnd, &sub.CancelAt, &sub.CanceledAt, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no subscription found, please use checkout to subscribe first"})
	}
	if err != nil {
		log.Printf("error querying subscription: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	if sub.StripeSubscriptionID == nil || *sub.StripeSubscriptionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "no active Stripe subscription, please use checkout to subscribe first"})
	}

	if sub.Plan == body.Plan {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "already on this plan"})
	}

	// Update the subscription in Stripe
	if err := stripeClient.UpdateSubscription(*sub.StripeSubscriptionID, body.Plan); err != nil {
		log.Printf("error updating Stripe subscription for org=%s: %v", orgID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to update subscription"})
	}

	// Update local DB
	_, err = h.DB.ExecContext(ctx,
		`UPDATE subscriptions SET plan = $1, updated_at = NOW() WHERE organization_id = $2`,
		body.Plan, orgID,
	)
	if err != nil {
		log.Printf("error updating subscription plan in DB for org=%s: %v", orgID, err)
		// Stripe was updated successfully, so don't fail the request — the webhook will sync
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok", "plan": body.Plan})
}

// CreatePortalSession handles POST /api/billing/portal
func (h *Handler) CreatePortalSession(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	var body struct {
		ReturnURL string `json:"return_url"`
	}
	if err := c.Bind(&body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if body.ReturnURL == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "return_url is required"})
	}

	if stripeClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "billing service not configured"})
	}

	ctx := context.Background()

	// Get or create subscription row with Stripe customer
	var customerID string
	err := h.DB.QueryRowContext(ctx,
		`SELECT stripe_customer_id FROM subscriptions WHERE organization_id = $1`,
		orgID,
	).Scan(&customerID)

	if err == sql.ErrNoRows {
		// No subscription yet — create a Stripe customer and subscription row
		userID := getUserID(c)
		newCustomerID, createErr := stripeClient.CreateCustomer(orgID, userID+"@spondic.app")
		if createErr != nil {
			log.Printf("error creating Stripe customer for portal: %v", createErr)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create billing customer"})
		}
		customerID = newCustomerID

		_, insertErr := h.DB.ExecContext(ctx,
			`INSERT INTO subscriptions (organization_id, stripe_customer_id, plan, status)
			 VALUES ($1, $2, 'free', 'active')
			 ON CONFLICT (organization_id) DO NOTHING`,
			orgID, customerID,
		)
		if insertErr != nil {
			log.Printf("error inserting subscription for portal: %v", insertErr)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
	} else if err != nil {
		log.Printf("error querying subscription: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	portalURL, err := stripeClient.CreatePortalSession(customerID, body.ReturnURL)
	if err != nil {
		log.Printf("error creating portal session for org=%s customer=%s: %v", orgID, customerID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create portal session"})
	}

	return c.JSON(http.StatusOK, map[string]string{"portal_url": portalURL})
}

// HandleWebhook handles POST /billing/webhook (no auth — verifies Stripe signature)
func (h *Handler) HandleWebhook(c echo.Context) error {
	if stripeClient == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "billing service not configured"})
	}

	payload, err := io.ReadAll(c.Request().Body)
	if err != nil {
		log.Printf("error reading webhook body: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
	}

	signature := c.Request().Header.Get("Stripe-Signature")
	event, err := stripeClient.ConstructWebhookEvent(payload, signature)
	if err != nil {
		log.Printf("error verifying webhook signature: %v", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid webhook signature"})
	}

	ctx := context.Background()

	// Always return 200 after signature verification to prevent Stripe retry storms.
	// Errors are logged but don't cause retries for permanently-failing events.
	switch event.Type {
	case "checkout.session.completed":
		if err := h.handleCheckoutCompleted(ctx, event); err != nil {
			log.Printf("error handling checkout.session.completed: %v", err)
		}

	case "invoice.paid":
		if err := h.handleInvoicePaid(ctx, event); err != nil {
			log.Printf("error handling invoice.paid: %v", err)
		}

	case "invoice.payment_failed":
		if err := h.handleInvoicePaymentFailed(ctx, event); err != nil {
			log.Printf("error handling invoice.payment_failed: %v", err)
		}

	case "customer.subscription.updated":
		if err := h.handleSubscriptionUpdated(ctx, event); err != nil {
			log.Printf("error handling customer.subscription.updated: %v", err)
		}

	case "customer.subscription.deleted":
		if err := h.handleSubscriptionDeleted(ctx, event); err != nil {
			log.Printf("error handling customer.subscription.deleted: %v", err)
		}
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

// handleCheckoutCompleted processes a completed checkout session.
// Note: the checkout session does not contain subscription items directly.
// The stripe_subscription_item_id will be set by the subsequent
// customer.subscription.updated webhook that Stripe fires after checkout.
func (h *Handler) handleCheckoutCompleted(ctx context.Context, event stripe.Event) error {
	var session struct {
		Customer     string `json:"customer"`
		Subscription string `json:"subscription"`
	}
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}

	_, err := h.DB.ExecContext(ctx,
		`UPDATE subscriptions
		 SET stripe_subscription_id = $1, status = 'active', updated_at = NOW()
		 WHERE stripe_customer_id = $2`,
		session.Subscription, session.Customer,
	)
	if err != nil {
		return err
	}

	// Audit log (non-fatal)
	var orgID string
	if lookupErr := h.DB.QueryRowContext(ctx,
		`SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`, session.Customer,
	).Scan(&orgID); lookupErr == nil {
		if _, auditErr := h.DB.ExecContext(ctx,
			`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			orgID, "system", "subscription.activated", "subscription", session.Subscription,
			fmt.Sprintf(`{"source":"stripe_webhook","event":"checkout.session.completed","customer":"%s"}`, session.Customer),
		); auditErr != nil {
			log.Printf("error writing audit log for checkout.session.completed: %v", auditErr)
		}
	}

	return nil
}

// handleInvoicePaid inserts an invoice record when payment succeeds.
func (h *Handler) handleInvoicePaid(ctx context.Context, event stripe.Event) error {
	var invoice struct {
		ID               string `json:"id"`
		Customer         string `json:"customer"`
		AmountPaid       int    `json:"amount_paid"`
		Currency         string `json:"currency"`
		Status           string `json:"status"`
		HostedInvoiceURL string `json:"hosted_invoice_url"`
		PeriodStart      int64  `json:"period_start"`
		PeriodEnd        int64  `json:"period_end"`
	}
	if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
		return err
	}

	// Look up org by customer ID
	var orgID string
	err := h.DB.QueryRowContext(ctx,
		`SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`,
		invoice.Customer,
	).Scan(&orgID)
	if err != nil {
		return err
	}

	periodStart := time.Unix(invoice.PeriodStart, 0)
	periodEnd := time.Unix(invoice.PeriodEnd, 0)

	_, err = h.DB.ExecContext(ctx,
		`INSERT INTO invoices (organization_id, stripe_invoice_id, amount_cents, currency, status, invoice_url, period_start, period_end)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (stripe_invoice_id) DO NOTHING`,
		orgID, invoice.ID, invoice.AmountPaid, invoice.Currency, invoice.Status,
		invoice.HostedInvoiceURL, periodStart, periodEnd,
	)
	if err != nil {
		return err
	}

	// Audit log (non-fatal)
	if _, auditErr := h.DB.ExecContext(ctx,
		`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		orgID, "system", "invoice.paid", "invoice", invoice.ID,
		fmt.Sprintf(`{"source":"stripe_webhook","event":"invoice.paid","amount_cents":%d,"currency":"%s"}`, invoice.AmountPaid, invoice.Currency),
	); auditErr != nil {
		log.Printf("error writing audit log for invoice.paid: %v", auditErr)
	}

	return nil
}

// handleInvoicePaymentFailed marks the subscription as past_due.
func (h *Handler) handleInvoicePaymentFailed(ctx context.Context, event stripe.Event) error {
	var invoice struct {
		Customer string `json:"customer"`
	}
	if err := json.Unmarshal(event.Data.Raw, &invoice); err != nil {
		return err
	}

	_, err := h.DB.ExecContext(ctx,
		`UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
		 WHERE stripe_customer_id = $1`,
		invoice.Customer,
	)
	if err != nil {
		return err
	}

	// Audit log (non-fatal)
	var orgID string
	if lookupErr := h.DB.QueryRowContext(ctx,
		`SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`, invoice.Customer,
	).Scan(&orgID); lookupErr == nil {
		if _, auditErr := h.DB.ExecContext(ctx,
			`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			orgID, "system", "invoice.payment_failed", "subscription", invoice.Customer,
			`{"source":"stripe_webhook","event":"invoice.payment_failed"}`,
		); auditErr != nil {
			log.Printf("error writing audit log for invoice.payment_failed: %v", auditErr)
		}
	}

	return nil
}

// handleSubscriptionUpdated syncs subscription fields from Stripe.
func (h *Handler) handleSubscriptionUpdated(ctx context.Context, event stripe.Event) error {
	var sub struct {
		ID                 string `json:"id"`
		Customer           string `json:"customer"`
		Status             string `json:"status"`
		CurrentPeriodStart int64  `json:"current_period_start"`
		CurrentPeriodEnd   int64  `json:"current_period_end"`
		CancelAt           *int64 `json:"cancel_at"`
		Items              struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		} `json:"items"`
	}
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return err
	}

	periodStart := time.Unix(sub.CurrentPeriodStart, 0)
	periodEnd := time.Unix(sub.CurrentPeriodEnd, 0)

	var cancelAt *time.Time
	if sub.CancelAt != nil && *sub.CancelAt > 0 {
		t := time.Unix(*sub.CancelAt, 0)
		cancelAt = &t
	}

	// Extract the first subscription item ID (si_xxx) for metered billing
	var subItemID *string
	if len(sub.Items.Data) > 0 && sub.Items.Data[0].ID != "" {
		subItemID = &sub.Items.Data[0].ID
	}

	_, err := h.DB.ExecContext(ctx,
		`UPDATE subscriptions
		 SET status = $1, current_period_start = $2, current_period_end = $3,
		     cancel_at = $4, stripe_subscription_item_id = COALESCE($5, stripe_subscription_item_id),
		     updated_at = NOW()
		 WHERE stripe_customer_id = $6`,
		sub.Status, periodStart, periodEnd, cancelAt, subItemID, sub.Customer,
	)
	if err != nil {
		return err
	}

	// Audit log (non-fatal)
	var orgID string
	if lookupErr := h.DB.QueryRowContext(ctx,
		`SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`, sub.Customer,
	).Scan(&orgID); lookupErr == nil {
		if _, auditErr := h.DB.ExecContext(ctx,
			`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			orgID, "system", "subscription.updated", "subscription", sub.ID,
			fmt.Sprintf(`{"source":"stripe_webhook","event":"customer.subscription.updated","status":"%s"}`, sub.Status),
		); auditErr != nil {
			log.Printf("error writing audit log for customer.subscription.updated: %v", auditErr)
		}
	}

	return nil
}

// handleSubscriptionDeleted marks a subscription as canceled.
func (h *Handler) handleSubscriptionDeleted(ctx context.Context, event stripe.Event) error {
	var sub struct {
		Customer string `json:"customer"`
	}
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		return err
	}

	now := time.Now()
	_, err := h.DB.ExecContext(ctx,
		`UPDATE subscriptions
		 SET status = 'canceled', canceled_at = $1, updated_at = NOW()
		 WHERE stripe_customer_id = $2`,
		now, sub.Customer,
	)
	if err != nil {
		return err
	}

	// Audit log (non-fatal)
	var orgID string
	if lookupErr := h.DB.QueryRowContext(ctx,
		`SELECT organization_id FROM subscriptions WHERE stripe_customer_id = $1`, sub.Customer,
	).Scan(&orgID); lookupErr == nil {
		if _, auditErr := h.DB.ExecContext(ctx,
			`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			orgID, "system", "subscription.canceled", "subscription", sub.Customer,
			`{"source":"stripe_webhook","event":"customer.subscription.deleted"}`,
		); auditErr != nil {
			log.Printf("error writing audit log for customer.subscription.deleted: %v", auditErr)
		}
	}

	return nil
}

// GetInvoices handles GET /api/billing/invoices — returns invoice history for the org.
func (h *Handler) GetInvoices(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	ctx := context.Background()
	rows, err := h.DB.QueryContext(ctx,
		`SELECT id, organization_id, stripe_invoice_id, amount_cents, currency, status,
		        invoice_url, period_start, period_end, created_at
		 FROM invoices
		 WHERE organization_id = $1
		 ORDER BY created_at DESC
		 LIMIT 24`,
		orgID,
	)
	if err != nil {
		log.Printf("error querying invoices: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	invoices := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id, orgId, stripeId, currency, status string
			amountCents                           int
			invoiceURL                            *string
			periodStart, periodEnd, createdAt     time.Time
		)
		if err := rows.Scan(&id, &orgId, &stripeId, &amountCents, &currency, &status,
			&invoiceURL, &periodStart, &periodEnd, &createdAt); err != nil {
			log.Printf("error scanning invoice: %v", err)
			continue
		}
		invoices = append(invoices, map[string]interface{}{
			"id":                id,
			"stripe_invoice_id": stripeId,
			"amount_cents":      amountCents,
			"currency":          currency,
			"status":            status,
			"invoice_url":       invoiceURL,
			"period_start":      periodStart,
			"period_end":        periodEnd,
			"created_at":        createdAt,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"invoices": invoices,
	})
}

// GetSubscription handles GET /api/billing/subscription
func (h *Handler) GetSubscription(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	ctx := context.Background()

	var sub models.Subscription
	err := h.DB.QueryRowContext(ctx,
		`SELECT id, organization_id, stripe_customer_id, stripe_subscription_id,
		        stripe_subscription_item_id, plan, status,
		        current_period_start, current_period_end, cancel_at, canceled_at, created_at, updated_at
		 FROM subscriptions WHERE organization_id = $1`,
		orgID,
	).Scan(
		&sub.ID, &sub.OrganizationID, &sub.StripeCustomerID, &sub.StripeSubscriptionID,
		&sub.StripeSubscriptionItemID, &sub.Plan, &sub.Status, &sub.CurrentPeriodStart,
		&sub.CurrentPeriodEnd, &sub.CancelAt, &sub.CanceledAt, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "no subscription found"})
	}
	if err != nil {
		log.Printf("error querying subscription: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}

	// Get plan limits
	var limits models.PlanLimits
	err = h.DB.QueryRowContext(ctx,
		`SELECT plan, max_rfps_per_month, max_documents, max_users, max_questions_per_rfp,
		        ai_review_enabled, compliance_enabled, template_library, analytics_enabled
		 FROM plan_limits WHERE plan = $1`,
		sub.Plan,
	).Scan(
		&limits.Plan, &limits.MaxRFPsPerMonth, &limits.MaxDocuments, &limits.MaxUsers,
		&limits.MaxQuestionsPerRFP, &limits.AIReviewEnabled, &limits.ComplianceEnabled,
		&limits.TemplateLibrary, &limits.AnalyticsEnabled,
	)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error querying plan limits: %v", err)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"subscription": sub,
		"plan_limits":  limits,
	})
}

// GetUsage handles GET /api/billing/usage
func (h *Handler) GetUsage(c echo.Context) error {
	orgID := getOrgID(c)
	if orgID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "organization_id is required"})
	}

	// Parse period param, default to current month (YYYY-MM)
	period := c.QueryParam("period")
	if period == "" {
		period = time.Now().Format("2006-01")
	}

	// Derive period start/end from YYYY-MM
	periodStart := period + "-01"
	t, err := time.Parse("2006-01-02", periodStart)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid period format, expected YYYY-MM"})
	}
	periodEnd := t.AddDate(0, 1, 0).Format("2006-01-02")

	ctx := context.Background()

	// Query usage records for the period
	rows, err := h.DB.QueryContext(ctx,
		`SELECT id, organization_id, metric, count, period_start, period_end, created_at, updated_at
		 FROM usage_records
		 WHERE organization_id = $1 AND period_start >= $2 AND period_start < $3`,
		orgID, periodStart, periodEnd,
	)
	if err != nil {
		log.Printf("error querying usage records: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
	defer rows.Close()

	usage := make([]models.UsageRecord, 0)
	for rows.Next() {
		var u models.UsageRecord
		if err := rows.Scan(
			&u.ID, &u.OrganizationID, &u.Metric, &u.Count,
			&u.PeriodStart, &u.PeriodEnd, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			log.Printf("error scanning usage record: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		usage = append(usage, u)
	}

	// Get current plan limits
	var plan string
	err = h.DB.QueryRowContext(ctx,
		`SELECT plan FROM subscriptions WHERE organization_id = $1`,
		orgID,
	).Scan(&plan)

	var limits models.PlanLimits
	if err == nil {
		scanErr := h.DB.QueryRowContext(ctx,
			`SELECT plan, max_rfps_per_month, max_documents, max_users, max_questions_per_rfp,
			        ai_review_enabled, compliance_enabled, template_library, analytics_enabled
			 FROM plan_limits WHERE plan = $1`,
			plan,
		).Scan(
			&limits.Plan, &limits.MaxRFPsPerMonth, &limits.MaxDocuments, &limits.MaxUsers,
			&limits.MaxQuestionsPerRFP, &limits.AIReviewEnabled, &limits.ComplianceEnabled,
			&limits.TemplateLibrary, &limits.AnalyticsEnabled,
		)
		if scanErr != nil && scanErr != sql.ErrNoRows {
			log.Printf("error querying plan limits: %v", scanErr)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"usage":       usage,
		"plan_limits": limits,
		"period":      period,
	})
}

// GetTokenUsage handles GET /api/billing/token-usage
// Returns the current month's AI token usage, allowance, and overage.
func (h *Handler) GetTokenUsage(c echo.Context) error {
	orgID := getOrgID(c)
	now := time.Now()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	ps := periodStart.Format("2006-01-02")

	var tokensUsed, tokensOverage int64
	var maxTokens *int64
	var overageRate *int
	var plan string

	// Get plan info
	err := h.DB.QueryRow(
		`SELECT s.plan, pl.max_tokens_per_month, pl.overage_rate_cents_per_1k
		 FROM subscriptions s
		 JOIN plan_limits pl ON pl.plan = s.plan
		 WHERE s.organization_id = $1 AND s.status IN ('active', 'trialing')`,
		orgID,
	).Scan(&plan, &maxTokens, &overageRate)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("error fetching plan for token usage: %v", err)
	}

	// Get current usage
	_ = h.DB.QueryRow(
		`SELECT COALESCE(count, 0) FROM usage_records
		 WHERE organization_id = $1 AND metric = 'ai_tokens_used' AND period_start = $2`,
		orgID, ps,
	).Scan(&tokensUsed)

	_ = h.DB.QueryRow(
		`SELECT COALESCE(count, 0) FROM usage_records
		 WHERE organization_id = $1 AND metric = 'ai_tokens_overage' AND period_start = $2`,
		orgID, ps,
	).Scan(&tokensOverage)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"tokens_used":               tokensUsed,
		"tokens_overage":            tokensOverage,
		"max_tokens_per_month":      maxTokens,
		"overage_rate_cents_per_1k": overageRate,
		"plan":                      plan,
		"period_start":              ps,
	})
}
