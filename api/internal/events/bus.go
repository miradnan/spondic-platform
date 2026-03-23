package events

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/lib/pq"
)

// Scope determines who receives an event.
type Scope string

const (
	ScopeUser Scope = "user" // Only the specific user (e.g. uploader)
	ScopeTeam Scope = "team" // All members of a team
	ScopeOrg  Scope = "org"  // Everyone in the organization
)

// Event is a scoped notification delivered via SSE.
type Event struct {
	// Routing fields — used for delivery, included in SSE payload
	Scope    Scope  `json:"scope"`
	OrgID    string `json:"org_id"`
	TargetID string `json:"target_id,omitempty"` // user_id for ScopeUser, team_id for ScopeTeam, empty for ScopeOrg

	// Payload
	Type string          `json:"type"` // e.g. "document.status", "project.updated"
	Data json.RawMessage `json:"data"`
}

// Subscriber represents an SSE client with its identity for scope matching.
type Subscriber struct {
	Ch      chan Event
	UserID  string
	TeamIDs []string // teams this user belongs to
}

// Bus uses PostgreSQL LISTEN/NOTIFY for cross-instance pub/sub,
// with in-memory fan-out to local SSE subscribers scoped by user/team/org.
type Bus struct {
	dsn string

	mu          sync.RWMutex
	subscribers map[string][]Subscriber // orgID -> list of subscribers
}

const pgChannel = "app_events"

// NewBus creates a new event bus backed by Postgres LISTEN/NOTIFY.
func NewBus(dsn string) *Bus {
	return &Bus{
		dsn:         dsn,
		subscribers: make(map[string][]Subscriber),
	}
}

// StartListener opens a dedicated Postgres connection for LISTEN
// and fans out received notifications to local subscribers.
// It reconnects automatically on failure. Call this in a goroutine.
func (b *Bus) StartListener() {
	for {
		if err := b.listen(); err != nil {
			log.Printf("[events] listener error: %v — reconnecting in 3s", err)
		}
		time.Sleep(3 * time.Second)
	}
}

func (b *Bus) listen() error {
	listener := pq.NewListener(b.dsn, 10*time.Second, time.Minute, func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Printf("[events] pq listener event: %v", err)
		}
	})
	defer listener.Close()

	if err := listener.Listen(pgChannel); err != nil {
		return err
	}

	log.Printf("[events] listening on pg channel %q", pgChannel)

	for {
		notification, ok := <-listener.Notify
		if !ok {
			return nil
		}
		if notification == nil {
			continue // reconnect ping
		}

		var evt Event
		if err := json.Unmarshal([]byte(notification.Extra), &evt); err != nil {
			log.Printf("[events] bad payload: %v", err)
			continue
		}

		b.fanOut(evt)
	}
}

// fanOut dispatches an event to matching local subscribers based on scope.
func (b *Bus) fanOut(evt Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, sub := range b.subscribers[evt.OrgID] {
		if !b.matches(evt, sub) {
			continue
		}
		select {
		case sub.Ch <- evt:
		default:
			// slow consumer — drop
		}
	}
}

// matches checks if a subscriber should receive this event.
func (b *Bus) matches(evt Event, sub Subscriber) bool {
	switch evt.Scope {
	case ScopeUser:
		return sub.UserID == evt.TargetID
	case ScopeTeam:
		for _, tid := range sub.TeamIDs {
			if tid == evt.TargetID {
				return true
			}
		}
		return false
	case ScopeOrg:
		return true // everyone in the org
	default:
		return false
	}
}

// Publish sends an event via Postgres NOTIFY.
func (b *Bus) Publish(db *sql.DB, evt Event) {
	payload, _ := json.Marshal(evt)
	_, err := db.Exec("SELECT pg_notify($1, $2)", pgChannel, string(payload))
	if err != nil {
		log.Printf("[events] pg_notify error: %v", err)
	}
}

// Helper constructors for common publish patterns.

// PublishToUser sends an event scoped to a single user.
func (b *Bus) PublishToUser(db *sql.DB, orgID, userID, eventType string, data any) {
	raw, _ := json.Marshal(data)
	b.Publish(db, Event{
		Scope:    ScopeUser,
		OrgID:    orgID,
		TargetID: userID,
		Type:     eventType,
		Data:     raw,
	})
}

// PublishToTeam sends an event scoped to a team.
func (b *Bus) PublishToTeam(db *sql.DB, orgID, teamID, eventType string, data any) {
	raw, _ := json.Marshal(data)
	b.Publish(db, Event{
		Scope:    ScopeTeam,
		OrgID:    orgID,
		TargetID: teamID,
		Type:     eventType,
		Data:     raw,
	})
}

// PublishToOrg sends an event scoped to the entire organization.
func (b *Bus) PublishToOrg(db *sql.DB, orgID, eventType string, data any) {
	raw, _ := json.Marshal(data)
	b.Publish(db, Event{
		Scope: ScopeOrg,
		OrgID: orgID,
		Type:  eventType,
		Data:  raw,
	})
}

// Subscribe registers an SSE subscriber for the given org with their identity.
func (b *Bus) Subscribe(orgID, userID string, teamIDs []string) *Subscriber {
	b.mu.Lock()
	defer b.mu.Unlock()

	sub := Subscriber{
		Ch:      make(chan Event, 16),
		UserID:  userID,
		TeamIDs: teamIDs,
	}
	b.subscribers[orgID] = append(b.subscribers[orgID], sub)
	return &sub
}

// Unsubscribe removes a subscriber and closes its channel.
func (b *Bus) Unsubscribe(orgID string, sub *Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()

	subs := b.subscribers[orgID]
	for i, s := range subs {
		if s.Ch == sub.Ch {
			b.subscribers[orgID] = append(subs[:i], subs[i+1:]...)
			break
		}
	}
	if len(b.subscribers[orgID]) == 0 {
		delete(b.subscribers, orgID)
	}
	close(sub.Ch)
}
