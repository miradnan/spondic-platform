package services

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// WebhookService handles sending notifications to Slack and Teams webhooks.
type WebhookService struct {
	DB *sql.DB
}

// NewWebhookService constructs a WebhookService.
func NewWebhookService(db *sql.DB) *WebhookService {
	return &WebhookService{DB: db}
}

// SendSlackMessage sends a notification to a Slack incoming webhook.
func (w *WebhookService) SendSlackMessage(webhookURL, title, text string) error {
	// Slack Block Kit with markdown formatting
	payload := map[string]interface{}{
		"blocks": []map[string]interface{}{
			{
				"type": "header",
				"text": map[string]string{
					"type": "plain_text",
					"text": title,
				},
			},
			{
				"type": "section",
				"text": map[string]string{
					"type": "mrkdwn",
					"text": text,
				},
			},
			{
				"type": "context",
				"elements": []map[string]string{
					{
						"type": "mrkdwn",
						"text": fmt.Sprintf("_Sent by RFPDraft at %s_", time.Now().Format("Jan 2, 2006 3:04 PM")),
					},
				},
			},
		},
	}

	return w.postJSON(webhookURL, payload)
}

// SendTeamsMessage sends a notification to a Microsoft Teams incoming webhook.
func (w *WebhookService) SendTeamsMessage(webhookURL, title, text string) error {
	// Teams MessageCard format
	payload := map[string]interface{}{
		"@type":      "MessageCard",
		"@context":   "http://schema.org/extensions",
		"summary":    title,
		"themeColor": "2d5fa0",
		"title":      title,
		"sections": []map[string]interface{}{
			{
				"text": text,
				"facts": []map[string]string{
					{
						"name":  "Source",
						"value": "RFPDraft",
					},
					{
						"name":  "Time",
						"value": time.Now().Format("Jan 2, 2006 3:04 PM"),
					},
				},
			},
		},
	}

	return w.postJSON(webhookURL, payload)
}

// NotifyWebhooks sends notifications to all active webhooks for the org that
// are subscribed to the given event type. Runs asynchronously so the caller
// is not blocked.
func (w *WebhookService) NotifyWebhooks(orgID, eventType, title, message string) {
	go func() {
		rows, err := w.DB.Query(
			`SELECT id, platform, webhook_url, channel_name, notify_on
			 FROM webhook_integrations
			 WHERE organization_id = $1 AND is_active = true`,
			orgID,
		)
		if err != nil {
			log.Printf("error querying webhook integrations: %v", err)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var id, platform, webhookURL string
			var channelName *string
			var notifyOnRaw []byte

			if err := rows.Scan(&id, &platform, &webhookURL, &channelName, &notifyOnRaw); err != nil {
				log.Printf("error scanning webhook integration: %v", err)
				continue
			}

			// Check if this webhook is subscribed to the event type
			var notifyOn []string
			if err := json.Unmarshal(notifyOnRaw, &notifyOn); err != nil {
				log.Printf("error parsing notify_on for webhook %s: %v", id, err)
				continue
			}

			subscribed := false
			for _, e := range notifyOn {
				if e == eventType {
					subscribed = true
					break
				}
			}
			if !subscribed {
				continue
			}

			// Send to the appropriate platform
			var sendErr error
			switch strings.ToLower(platform) {
			case "slack":
				sendErr = w.SendSlackMessage(webhookURL, title, message)
			case "teams":
				sendErr = w.SendTeamsMessage(webhookURL, title, message)
			default:
				log.Printf("unknown webhook platform %q for integration %s", platform, id)
				continue
			}

			if sendErr != nil {
				log.Printf("error sending webhook notification (id=%s, platform=%s): %v", id, platform, sendErr)
			}
		}
	}()
}

// postJSON marshals payload to JSON and POSTs it to the given URL.
func (w *WebhookService) postJSON(url string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("POST to webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}
