package main

import (
	"log"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/spondic/api/internal/config"
	"github.com/spondic/api/internal/database"
	"github.com/spondic/api/internal/events"
	"github.com/spondic/api/internal/handlers"
	"github.com/spondic/api/internal/middleware"
	"github.com/spondic/api/internal/services"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("database connected")

	// Initialize S3 client
	var s3Client *services.S3Client
	if cfg.AWSS3Bucket != "" {
		s3Client, err = services.NewS3Client(cfg.AWSRegion, cfg.AWSS3Bucket)
		if err != nil {
			log.Printf("warning: S3 client initialization failed: %v", err)
		} else {
			log.Println("S3 client initialized")
		}
	} else {
		log.Println("warning: AWS_S3_BUCKET not set, file uploads will be disabled")
	}

	// Initialize AI service client
	aiClient := services.NewAIClient(cfg.AIServiceURL)
	log.Printf("AI service client pointing to %s", cfg.AIServiceURL)

	// Initialize Stripe client (optional)
	if cfg.StripeSecretKey != "" {
		stripePrices := map[string]string{
			"starter":    cfg.StripePriceStarter,
			"growth":     cfg.StripePriceGrowth,
			"enterprise": cfg.StripePriceEnterprise,
		}
		sc := services.NewStripeClient(cfg.StripeSecretKey, cfg.StripeWebhookSecret, stripePrices)
		handlers.SetStripeClient(sc)
		log.Println("Stripe billing configured")
	} else {
		log.Println("warning: STRIPE_SECRET_KEY not set, billing will be disabled")
	}

	// Initialize SES client (optional)
	var sesClient *services.SESClient
	if cfg.SESFromEmail != "" {
		var sesErr error
		sesClient, sesErr = services.NewSESClient(cfg.SESRegion, cfg.SESFromEmail)
		if sesErr != nil {
			log.Printf("warning: SES client initialization failed: %v", sesErr)
		} else {
			log.Println("SES email client initialized")
		}
	} else {
		log.Println("warning: SES_FROM_EMAIL not set, email notifications will be disabled")
	}

	// Initialize notification service
	notifier := services.NewNotificationService(db, sesClient)

	// Initialize webhook service
	webhookSvc := services.NewWebhookService(db)
	log.Println("Webhook notification service initialized")

	// Initialize Clerk Backend API key for user search
	if cfg.ClerkSecretKey != "" {
		handlers.SetClerkSecretKey(cfg.ClerkSecretKey)
		log.Println("Clerk Backend API configured for user search")
	} else {
		log.Println("warning: CLERK_SECRET_KEY not set, user search will be disabled")
	}

	// Initialize handler with all dependencies
	eventBus := events.NewBus(cfg.DatabaseURL)
	go eventBus.StartListener()
	log.Println("document event bus started (pg LISTEN/NOTIFY)")

	h := handlers.NewHandler(db, s3Client, aiClient, cfg.AWSS3Bucket)
	h.Notifier = notifier
	h.Webhooks = webhookSvc
	h.Events = eventBus

	// Setup Echo
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(middleware.CORS(cfg.CORSOrigins))

	// Health check (no auth)
	e.GET("/health", handlers.HealthCheck)

	// Stripe webhook (no auth — uses Stripe signature verification)
	e.POST("/billing/webhook", h.HandleWebhook)

	// API group — require auth + ensure org + plan enforcement + RLS context + audit logging
	// Note: CORS is handled globally above — not duplicated here
	authMiddleware := middleware.ClerkAuth(cfg.ClerkJWKSURL)
	ensureOrgMiddleware := middleware.EnsureOrg(db)
	planMiddleware := middleware.CheckPlanLimits(db)
	rlsMiddleware := middleware.SetRLSContext(db)
	auditMiddleware := middleware.AuditLogger(db)

	api := e.Group("/api", authMiddleware, ensureOrgMiddleware, planMiddleware, rlsMiddleware, auditMiddleware)

	// Projects
	api.POST("/projects", h.CreateProject)
	api.GET("/projects", h.ListProjects)
	api.GET("/projects/:id", h.GetProject)
	api.PUT("/projects/:id", h.UpdateProject)
	api.DELETE("/projects/:id", h.DeleteProject)

	// RFP upload, parse, draft
	api.POST("/rfp", h.UploadRFP)
	api.POST("/rfp/:id/parse", h.ParseRFP)
	api.POST("/rfp/:id/draft", h.DraftRFP)

	// RFP questions
	api.GET("/rfp/:id/questions", h.ListQuestions)
	api.PUT("/rfp/:id/questions/:qid", h.UpdateQuestion)
	api.POST("/rfp/:id/questions/:qid/redraft", h.RedraftQuestion)

	// RFP answers
	api.GET("/rfp/:id/answers", h.ListAnswers)
	api.PUT("/rfp/:id/answers/:aid", h.UpdateAnswer)
	api.POST("/rfp/:id/answers/:aid/approve", h.ApproveAnswer)
	api.POST("/rfp/:id/answers/:aid/comment", h.CommentOnAnswer)
	api.GET("/rfp/:id/answers/:aid/history", h.ListAnswerHistory)

	// Approval workflows
	api.POST("/projects/:id/approval-stages", h.CreateApprovalStages)
	api.GET("/projects/:id/approval-stages", h.ListApprovalStages)
	api.POST("/rfp/:id/answers/:aid/stage-approve", h.StageApprove)
	api.GET("/rfp/:id/answers/:aid/approvals", h.ListAnswerApprovals)
	api.GET("/rfp/:id/approvals", h.ListAllAnswerApprovals)

	// Knowledge base documents
	api.POST("/documents", h.UploadDocuments)
	api.GET("/documents", h.ListDocuments)
	api.GET("/documents/search", h.SearchDocuments)
	api.GET("/documents/events", h.DocumentEvents)
	api.GET("/documents/:id", h.GetDocument)
	api.DELETE("/documents/:id", h.DeleteDocument)
	api.GET("/documents/:id/preview-url", h.DocumentPreviewURL)
	api.POST("/documents/:id/reindex", h.ReindexDocument)
	api.POST("/documents/:id/tags", h.AddDocumentTag)
	api.DELETE("/documents/:id/tags/:tagId", h.RemoveDocumentTag)

	// Users (Clerk search)
	api.GET("/users/search", h.SearchUsers)

	// User profile (proxies to Clerk Backend API)
	api.GET("/user/profile", h.GetUserProfile)
	api.PUT("/user/profile", h.UpdateUserProfile)
	api.PUT("/user/password", h.UpdateUserPassword)
	api.POST("/user/avatar", h.UploadUserAvatar)
	api.DELETE("/user/avatar", h.DeleteUserAvatar)
	api.GET("/user/2fa", h.GetUser2FAStatus)
	api.DELETE("/user/2fa", h.DisableUserMFA)

	// Teams
	api.GET("/teams", h.ListTeams)
	api.POST("/teams", h.CreateTeam)
	api.POST("/teams/seed", h.SeedDefaultTeams)
	api.PUT("/teams/:id", h.UpdateTeam)
	api.DELETE("/teams/:id", h.DeleteTeam)
	api.GET("/teams/:id/members", h.ListTeamMembers)
	api.POST("/teams/:id/members", h.AddTeamMember)
	api.DELETE("/teams/:id/members/:userId", h.RemoveTeamMember)

	// Tags
	api.POST("/tags", h.CreateTag)
	api.GET("/tags", h.ListTags)
	api.DELETE("/tags/:id", h.DeleteTag)

	// Chat
	api.POST("/chats", h.CreateChat)
	api.GET("/chats", h.ListChats)
	api.DELETE("/chats/:id", h.DeleteChat)
	api.POST("/chats/:id/messages", h.SendMessage)
	api.POST("/chats/:id/messages/stream", h.SendMessageStream)
	api.GET("/chats/:id/messages", h.GetMessages)

	// Export
	api.POST("/rfp/:id/export/docx", h.ExportDOCX)
	api.POST("/rfp/:id/export/pdf", h.ExportPDF)
	api.POST("/rfp/:id/export/xlsx", h.ExportXLSX)

	// Analytics
	api.GET("/analytics/overview", h.AnalyticsOverview)
	api.GET("/analytics/timeline", h.AnalyticsTimeline)
	api.GET("/analytics/user-performance", h.AnalyticsUserPerformance)

	// Audit logs (admin only — for now, all authenticated users can access)
	api.GET("/audit-logs", h.ListAuditLogs)

	// Plan info (from JWT claim — no DB needed)
	api.GET("/plan", h.GetPlan)

	// Billing (authenticated)
	// NOTE: Checkout and portal endpoints below are deprecated in favor of Clerk-managed
	// Stripe billing. They remain for backward compatibility but Clerk now handles
	// subscription checkout and portal flows via the "pla" JWT claim.
	api.POST("/billing/checkout", h.CreateCheckout)
	api.POST("/billing/portal", h.CreatePortalSession)
	api.GET("/billing/subscription", h.GetSubscription)
	api.GET("/billing/usage", h.GetUsage)
	api.GET("/billing/token-usage", h.GetTokenUsage)

	// Notifications
	api.GET("/notifications", h.ListNotifications)
	api.GET("/notifications/unread-count", h.UnreadCount)
	api.PUT("/notifications/:id/read", h.MarkNotificationRead)
	api.PUT("/notifications/read-all", h.MarkAllNotificationsRead)
	api.GET("/notifications/preferences", h.GetNotificationPreferences)
	api.PUT("/notifications/preferences", h.UpdateNotificationPreference)

	// Templates
	api.POST("/templates", h.CreateTemplate)
	api.GET("/templates", h.ListTemplates)
	api.GET("/templates/:id", h.GetTemplate)
	api.PUT("/templates/:id", h.UpdateTemplate)
	api.DELETE("/templates/:id", h.DeleteTemplate)
	api.POST("/templates/suggest", h.SuggestTemplate)

	// Branding / white-label
	api.GET("/branding", h.GetBranding)
	api.PUT("/branding", h.UpdateBranding)
	api.POST("/branding/logo", h.UploadBrandingLogo)

	// Webhook integrations (Slack / Teams)
	api.POST("/integrations/webhooks", h.CreateWebhookIntegration)
	api.GET("/integrations/webhooks", h.ListWebhookIntegrations)
	api.PUT("/integrations/webhooks/:id", h.UpdateWebhookIntegration)
	api.DELETE("/integrations/webhooks/:id", h.DeleteWebhookIntegration)
	api.POST("/integrations/webhooks/:id/test", h.TestWebhookIntegration)

	// Project outcomes / Win-Loss
	api.POST("/projects/:id/outcome", h.RecordOutcome)
	api.GET("/analytics/win-loss", h.GetWinLossAnalytics)

	// CRM integrations
	api.GET("/integrations/crm", h.ListCRMConnections)
	api.POST("/integrations/crm/connect", h.ConnectCRM)
	api.DELETE("/integrations/crm/:id", h.DisconnectCRM)
	api.POST("/integrations/crm/:id/sync", h.SyncCRM)

	// Project CRM links
	api.GET("/projects/:id/crm-link", h.GetProjectCRMLink)
	api.POST("/projects/:id/crm-link", h.LinkProjectToCRM)
	api.DELETE("/projects/:id/crm-link", h.UnlinkProjectFromCRM)

	// Start server
	log.Printf("starting server on :%s", cfg.Port)
	e.Logger.Fatal(e.Start(":" + cfg.Port))
}
