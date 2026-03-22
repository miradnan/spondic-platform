package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AIClient communicates with the Python AI service.
type AIClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewAIClient creates a client for the AI service.
func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

// IndexDocumentRequest is the payload sent to the AI service for indexing.
type IndexDocumentRequest struct {
	OrganizationID string `json:"organization_id"`
	DocumentID     string `json:"document_id"`
	S3Key          string `json:"s3_key"`
}

// IndexDocumentResponse is the response from the AI /index endpoint.
type IndexDocumentResponse struct {
	Status     string `json:"status"`
	ChunkCount int    `json:"chunk_count,omitempty"`
	Error      string `json:"error,omitempty"`
}

// IndexDocument sends a document for indexing (parse, chunk, embed, store).
func (a *AIClient) IndexDocument(ctx context.Context, orgID, docID, s3Key string) (*IndexDocumentResponse, error) {
	payload := IndexDocumentRequest{
		OrganizationID: orgID,
		DocumentID:     docID,
		S3Key:          s3Key,
	}
	var resp IndexDocumentResponse
	if err := a.post(ctx, "/index", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ParseRFPRequest is the payload for RFP parsing.
type ParseRFPRequest struct {
	OrganizationID string `json:"organization_id"`
	DocumentID     string `json:"document_id"`
	S3Key          string `json:"s3_key"`
}

// ParsedQuestion represents a question extracted by the AI service.
type ParsedQuestion struct {
	QuestionText string  `json:"question_text"`
	Section      string  `json:"section,omitempty"`
	Number       int     `json:"number,omitempty"`
	IsMandatory  bool    `json:"is_mandatory"`
	WordLimit    *int    `json:"word_limit,omitempty"`
}

// ParseRFPResponse is the response from the AI /parse endpoint.
type ParseRFPResponse struct {
	Status    string           `json:"status"`
	Questions []ParsedQuestion `json:"questions"`
	Error     string           `json:"error,omitempty"`
}

// ParseRFP sends an RFP document for question extraction.
func (a *AIClient) ParseRFP(ctx context.Context, orgID, docID, s3Key string) (*ParseRFPResponse, error) {
	payload := ParseRFPRequest{
		OrganizationID: orgID,
		DocumentID:     docID,
		S3Key:          s3Key,
	}
	var resp ParseRFPResponse
	if err := a.post(ctx, "/parse", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DraftQuestion is a question to be drafted by the AI service.
type DraftQuestion struct {
	QuestionID   string `json:"question_id"`
	QuestionText string `json:"question_text"`
	Section      string `json:"section,omitempty"`
	WordLimit    *int   `json:"word_limit,omitempty"`
}

// DraftRequest is the payload for answer generation.
type DraftRequest struct {
	OrganizationID string          `json:"organization_id"`
	ProjectID      string          `json:"project_id"`
	Questions      []DraftQuestion `json:"questions"`
}

// DraftedAnswer represents an AI-generated answer with citations.
type DraftedAnswer struct {
	QuestionID      string          `json:"question_id"`
	DraftText       string          `json:"draft_text"`
	ConfidenceScore float64         `json:"confidence_score"`
	Citations       []DraftCitation `json:"citations"`
}

// DraftCitation is a source citation for a drafted answer.
type DraftCitation struct {
	DocumentID     string  `json:"document_id"`
	ChunkID        string  `json:"chunk_id,omitempty"`
	CitationText   string  `json:"citation_text"`
	RelevanceScore float64 `json:"relevance_score"`
}

// DraftResponse is the response from the AI /draft endpoint.
type DraftResponse struct {
	Status  string          `json:"status"`
	Answers []DraftedAnswer `json:"answers"`
	Error   string          `json:"error,omitempty"`
}

// DraftAnswers generates AI answers for multiple questions.
func (a *AIClient) DraftAnswers(ctx context.Context, orgID, projectID string, questions []DraftQuestion) (*DraftResponse, error) {
	payload := DraftRequest{
		OrganizationID: orgID,
		ProjectID:      projectID,
		Questions:      questions,
	}
	var resp DraftResponse
	if err := a.post(ctx, "/draft", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ChatRequest is the payload for the AI chat endpoint.
type ChatRequest struct {
	OrganizationID string       `json:"organization_id"`
	Message        string       `json:"message"`
	ChatHistory    []ChatTurn   `json:"chat_history,omitempty"`
}

// ChatTurn represents a single turn in a conversation.
// Uses "content" to match the Python AI service's ChatHistoryMessage model.
type ChatTurn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCitation is a source citation returned by the AI chat endpoint.
type ChatCitation struct {
	DocumentTitle  string  `json:"document_title"`
	CitationText   string  `json:"citation_text"`
	RelevanceScore float64 `json:"relevance_score"`
}

// ChatResponse is the response from the AI /chat endpoint.
type ChatResponse struct {
	Response  string         `json:"response"`
	Citations []ChatCitation `json:"citations"`
	Error     string         `json:"error,omitempty"`
}

// Chat sends a message with history and returns the AI response.
func (a *AIClient) Chat(ctx context.Context, orgID, message string, history []ChatTurn) (*ChatResponse, error) {
	payload := ChatRequest{
		OrganizationID: orgID,
		Message:        message,
		ChatHistory:    history,
	}
	var resp ChatResponse
	if err := a.post(ctx, "/chat", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// SearchRequest is the payload for the AI /search endpoint.
type SearchRequest struct {
	OrganizationID string `json:"organization_id"`
	Query          string `json:"query"`
	Limit          int    `json:"limit,omitempty"`
}

// SearchResult represents a single search hit.
type SearchResult struct {
	DocumentID   string  `json:"document_id"`
	ChunkID      string  `json:"chunk_id"`
	Content      string  `json:"content"`
	Score        float64 `json:"score"`
	DocumentName string  `json:"document_name,omitempty"`
}

// SearchResponse is the response from the AI /search endpoint.
type SearchResponse struct {
	Status  string         `json:"status"`
	Results []SearchResult `json:"results"`
	Error   string         `json:"error,omitempty"`
}

// Search performs semantic search across the knowledge base.
func (a *AIClient) Search(ctx context.Context, orgID, query string, limit int) (*SearchResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	payload := SearchRequest{
		OrganizationID: orgID,
		Query:          query,
		Limit:          limit,
	}
	var resp SearchResponse
	if err := a.post(ctx, "/search", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteDocument removes a document's vectors from Weaviate.
func (a *AIClient) DeleteDocument(ctx context.Context, orgID, docID string) error {
	url := fmt.Sprintf("%s/documents/%s?organization_id=%s", a.baseURL, docID, orgID)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call AI delete endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI delete returned status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// post is a helper that POSTs JSON to the AI service and decodes the response.
func (a *AIClient) post(ctx context.Context, path string, payload interface{}, result interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call AI service %s: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("AI service %s returned status %d: %s", path, resp.StatusCode, string(respBody))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode AI response from %s: %w", path, err)
	}
	return nil
}
