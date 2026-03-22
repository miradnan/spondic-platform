package services

import (
	"context"
	"database/sql"
	"log"

	"github.com/spondic/api/internal/models"
)

// NotificationService handles creating notifications and sending email alerts.
type NotificationService struct {
	DB  *sql.DB
	SES *SESClient
}

// NewNotificationService constructs a NotificationService with the given dependencies.
func NewNotificationService(db *sql.DB, ses *SESClient) *NotificationService {
	return &NotificationService{
		DB:  db,
		SES: ses,
	}
}

// Create inserts a notification into the database and optionally sends an email.
// It checks the user's notification preferences for the given type.
// If no preference exists, defaults to in_app=true, email=false.
// Errors are logged but do not fail the caller.
func (ns *NotificationService) Create(orgID, userID, notifType, title, body, entityType, entityID string) error {
	// Check user preferences for this notification type
	var pref models.NotificationPreference
	err := ns.DB.QueryRow(
		`SELECT organization_id, user_id, type, in_app_enabled, email_enabled
		 FROM notification_preferences
		 WHERE organization_id = $1 AND user_id = $2 AND type = $3`,
		orgID, userID, notifType,
	).Scan(&pref.OrganizationID, &pref.UserID, &pref.Type, &pref.InAppEnabled, &pref.EmailEnabled)

	if err == sql.ErrNoRows {
		// Default: in-app enabled, email disabled
		pref = models.NotificationPreference{
			OrganizationID: orgID,
			UserID:         userID,
			Type:           notifType,
			InAppEnabled:   true,
			EmailEnabled:   false,
		}
	} else if err != nil {
		log.Printf("error checking notification preferences: %v", err)
		// Default to in-app only on error
		pref.InAppEnabled = true
		pref.EmailEnabled = false
	}

	// Insert notification if in-app is enabled
	if pref.InAppEnabled {
		_, err = ns.DB.Exec(
			`INSERT INTO notifications (organization_id, user_id, type, title, body, entity_type, entity_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			orgID, userID, notifType, title, nullableStr(body), nullableStr(entityType), nullableStr(entityID),
		)
		if err != nil {
			log.Printf("error inserting notification: %v", err)
			return err
		}
	}

	// Send email asynchronously if enabled and SES is configured
	if pref.EmailEnabled && ns.SES != nil {
		go func() {
			// Look up the user's email — for now we use the userID as a placeholder.
			// In production, resolve the email from Clerk user metadata or a local users table.
			emailAddr := "" // TODO: resolve user email from Clerk or local cache
			if emailAddr == "" {
				log.Printf("notification email skipped: no email address for user %s", userID)
				return
			}

			htmlBody := "<h3>" + title + "</h3>"
			if body != "" {
				htmlBody += "<p>" + body + "</p>"
			}

			if sendErr := ns.SES.SendEmail(context.Background(), emailAddr, title, htmlBody); sendErr != nil {
				log.Printf("error sending notification email to user %s: %v", userID, sendErr)
			} else {
				// Mark email_sent = true
				_, dbErr := ns.DB.Exec(
					`UPDATE notifications SET email_sent = true
					 WHERE organization_id = $1 AND user_id = $2 AND type = $3
					 ORDER BY created_at DESC LIMIT 1`,
					orgID, userID, notifType,
				)
				if dbErr != nil {
					log.Printf("error updating email_sent flag: %v", dbErr)
				}
			}
		}()
	}

	return nil
}

// nullableStr returns a *string pointer; nil if the string is empty.
func nullableStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
