package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
)

// exportQuestion holds structured data for a single Q&A used across all export formats.
type exportQuestion struct {
	QuestionNumber *int
	Section        *string
	QuestionText   string
	AnswerText     string
	Status         string
	Confidence     float64
	IsMandatory    bool
	Citations      []string
}

// getExportData fetches the project name and all questions with answers and citations,
// scoped to the given organization. Returns structured data for export rendering.
func (h *Handler) getExportData(orgID, projectID string) (string, []exportQuestion, error) {
	var projectName string
	err := h.DB.QueryRow(
		`SELECT name FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
		projectID, orgID,
	).Scan(&projectName)
	if err != nil {
		return "", nil, fmt.Errorf("project not found: %w", err)
	}

	rows, err := h.DB.Query(
		`SELECT q.question_number, q.section, q.question_text, q.is_mandatory,
		        a.id,
		        COALESCE(a.edited_text, a.draft_text, a.final_text, ''),
		        COALESCE(a.status, 'no_answer'),
		        COALESCE(a.confidence_score, 0)
		 FROM rfp_questions q
		 LEFT JOIN rfp_answers a ON a.question_id = q.id AND a.organization_id = q.organization_id
		 WHERE q.project_id = $1 AND q.organization_id = $2
		 ORDER BY q.sort_order, q.created_at`,
		projectID, orgID,
	)
	if err != nil {
		return "", nil, fmt.Errorf("failed to fetch questions: %w", err)
	}
	defer rows.Close()

	var questions []exportQuestion
	var answerIDs []string
	answerIndexMap := make(map[string]int) // answer_id -> index in questions slice

	for rows.Next() {
		var q exportQuestion
		var answerID *string
		if err := rows.Scan(&q.QuestionNumber, &q.Section, &q.QuestionText, &q.IsMandatory,
			&answerID, &q.AnswerText, &q.Status, &q.Confidence); err != nil {
			log.Printf("error scanning export row: %v", err)
			continue
		}
		idx := len(questions)
		questions = append(questions, q)
		if answerID != nil && *answerID != "" {
			answerIDs = append(answerIDs, *answerID)
			answerIndexMap[*answerID] = idx
		}
	}

	// Fetch citations for all answers in one query
	if len(answerIDs) > 0 {
		placeholders := make([]string, len(answerIDs))
		args := make([]interface{}, len(answerIDs))
		for i, id := range answerIDs {
			placeholders[i] = fmt.Sprintf("$%d", i+1)
			args[i] = id
		}
		citationQuery := fmt.Sprintf(
			`SELECT answer_id, citation_text FROM rfp_answer_citations WHERE answer_id IN (%s) ORDER BY created_at`,
			strings.Join(placeholders, ","),
		)
		citRows, err := h.DB.Query(citationQuery, args...)
		if err != nil {
			log.Printf("warning: could not fetch citations: %v", err)
		} else {
			defer citRows.Close()
			for citRows.Next() {
				var aid, citText string
				if err := citRows.Scan(&aid, &citText); err != nil {
					continue
				}
				if idx, ok := answerIndexMap[aid]; ok {
					questions[idx].Citations = append(questions[idx].Citations, citText)
				}
			}
		}
	}

	return projectName, questions, nil
}

// statusLabel returns a human-readable label for the answer status.
func statusLabel(status string) string {
	switch status {
	case "approved":
		return "Approved"
	case "in_review":
		return "In Review"
	case "rejected":
		return "Rejected"
	case "draft":
		return "Draft"
	default:
		return ""
	}
}

// ---------------------------------------------------------------------------
// DOCX Export — built manually using archive/zip and Office Open XML
// ---------------------------------------------------------------------------

// ExportDOCX handles POST /api/rfp/:id/export/docx
func (h *Handler) ExportDOCX(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	projectName, questions, err := h.getExportData(orgID, projectID)
	if err != nil {
		log.Printf("error building export content: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	docxBytes, err := buildDOCX(projectName, questions)
	if err != nil {
		log.Printf("error generating docx: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	filename := sanitizeFilename(projectName)
	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.docx"`, filename))
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docxBytes)
}

func buildDOCX(projectName string, questions []exportQuestion) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	// [Content_Types].xml
	contentTypes := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
	if err := addZipFile(zw, "[Content_Types].xml", contentTypes); err != nil {
		return nil, err
	}

	// _rels/.rels
	rels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
	if err := addZipFile(zw, "_rels/.rels", rels); err != nil {
		return nil, err
	}

	// word/_rels/document.xml.rels
	docRels := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`
	if err := addZipFile(zw, "word/_rels/document.xml.rels", docRels); err != nil {
		return nil, err
	}

	// word/document.xml — the main content
	documentXML := buildDocumentXML(projectName, questions)
	if err := addZipFile(zw, "word/document.xml", documentXML); err != nil {
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func addZipFile(zw *zip.Writer, name, content string) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write([]byte(content))
	return err
}

// xmlEscape escapes a string for safe inclusion in XML content.
func xmlEscape(s string) string {
	var buf bytes.Buffer
	if err := xml.EscapeText(&buf, []byte(s)); err != nil {
		return s
	}
	return buf.String()
}

func buildDocumentXML(projectName string, questions []exportQuestion) string {
	var b strings.Builder

	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>`)

	// Title
	b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>%s</w:t></w:r>
    </w:p>`, xmlEscape(projectName)))

	// Subtitle: RFP Response Document
	b.WriteString(`
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="666666"/></w:rPr><w:t>RFP Response Document</w:t></w:r>
    </w:p>`)

	// Date
	dateStr := time.Now().Format("January 2, 2006")
	b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="400"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="999999"/></w:rPr><w:t>%s</w:t></w:r>
    </w:p>`, xmlEscape(dateStr)))

	// Horizontal rule (border-bottom paragraph)
	b.WriteString(`
    <w:p>
      <w:pPr>
        <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>
        <w:spacing w:after="300"/>
      </w:pPr>
    </w:p>`)

	// Table of Contents heading
	b.WriteString(`
    <w:p>
      <w:pPr><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>Table of Contents</w:t></w:r>
    </w:p>`)

	// Collect unique sections for TOC
	seenSections := make(map[string]bool)
	var tocSections []string
	for _, q := range questions {
		if q.AnswerText == "" {
			continue
		}
		sec := ""
		if q.Section != nil {
			sec = *q.Section
		}
		if sec != "" && !seenSections[sec] {
			seenSections[sec] = true
			tocSections = append(tocSections, sec)
		}
	}

	for i, sec := range tocSections {
		b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:spacing w:after="40"/><w:ind w:left="360"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>%d. %s</w:t></w:r>
    </w:p>`, i+1, xmlEscape(sec)))
	}

	// Spacing after TOC
	b.WriteString(`
    <w:p><w:pPr><w:spacing w:after="300"/></w:pPr></w:p>`)

	// Questions and answers
	currentSection := ""
	for _, q := range questions {
		if q.AnswerText == "" {
			continue
		}

		sectionStr := ""
		if q.Section != nil {
			sectionStr = *q.Section
		}

		// Section header
		if sectionStr != "" && sectionStr != currentSection {
			currentSection = sectionStr
			b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr>
        <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="2D5FA0"/></w:pBdr>
        <w:spacing w:before="300" w:after="150"/>
      </w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="1A2740"/></w:rPr><w:t>%s</w:t></w:r>
    </w:p>`, xmlEscape(currentSection)))
		}

		// Question text (bold)
		qLabel := ""
		if q.QuestionNumber != nil {
			qLabel = fmt.Sprintf("Q%d: ", *q.QuestionNumber)
		}
		b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>%s%s</w:t></w:r>
    </w:p>`, xmlEscape(qLabel), xmlEscape(q.QuestionText)))

		// Answer text — split into paragraphs on newlines
		answerParagraphs := strings.Split(q.AnswerText, "\n")
		for _, para := range answerParagraphs {
			trimmed := strings.TrimSpace(para)
			if trimmed == "" {
				continue
			}
			b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>
    </w:p>`, xmlEscape(trimmed)))
		}

		// Status badge
		label := statusLabel(q.Status)
		if label != "" {
			color := "666666"
			switch q.Status {
			case "approved":
				color = "2E7D32"
			case "in_review":
				color = "F57F17"
			case "rejected":
				color = "C62828"
			}
			b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:spacing w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="%s"/></w:rPr><w:t>[%s]</w:t></w:r>
    </w:p>`, color, xmlEscape(label)))
		}

		// Citations (italic, smaller)
		if len(q.Citations) > 0 {
			citText := "Sources: " + strings.Join(q.Citations, "; ")
			b.WriteString(fmt.Sprintf(`
    <w:p>
      <w:pPr><w:spacing w:after="40"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="16"/><w:szCs w:val="16"/><w:color w:val="888888"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r>
    </w:p>`, xmlEscape(citText)))
		}

		// Separator
		b.WriteString(`
    <w:p>
      <w:pPr>
        <w:pBdr><w:bottom w:val="single" w:sz="2" w:space="1" w:color="EEEEEE"/></w:pBdr>
        <w:spacing w:after="100"/>
      </w:pPr>
    </w:p>`)
	}

	b.WriteString(`
  </w:body>
</w:document>`)

	return b.String()
}

// ---------------------------------------------------------------------------
// PDF Export — using gofpdf
// ---------------------------------------------------------------------------

// ExportPDF handles POST /api/rfp/:id/export/pdf
func (h *Handler) ExportPDF(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	projectName, questions, err := h.getExportData(orgID, projectID)
	if err != nil {
		log.Printf("error building export content: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetTitle(projectName, true)
	pdf.SetAuthor("RFPDraft", true)
	pdf.SetMargins(20, 20, 20)
	pdf.SetAutoPageBreak(true, 25)

	// Title page
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 28)
	pdf.Ln(40)
	pdf.MultiCell(0, 12, projectName, "", "C", false)
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "", 16)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 10, "RFP Response Document", "", 1, "C", false, 0, "")
	pdf.Ln(8)

	pdf.SetFont("Helvetica", "", 12)
	pdf.SetTextColor(150, 150, 150)
	dateStr := time.Now().Format("January 2, 2006")
	pdf.CellFormat(0, 8, dateStr, "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	// Table of Contents page
	pdf.AddPage()
	pdf.SetFont("Helvetica", "B", 20)
	pdf.CellFormat(0, 10, "Table of Contents", "", 1, "", false, 0, "")
	pdf.Ln(8)

	seenSections := make(map[string]bool)
	tocNum := 1
	for _, q := range questions {
		if q.AnswerText == "" {
			continue
		}
		sec := ""
		if q.Section != nil {
			sec = *q.Section
		}
		if sec != "" && !seenSections[sec] {
			seenSections[sec] = true
			pdf.SetFont("Helvetica", "", 12)
			pdf.CellFormat(0, 7, fmt.Sprintf("  %d.  %s", tocNum, toUTF8Safe(sec)), "", 1, "", false, 0, "")
			tocNum++
		}
	}

	// Content pages
	pdf.AddPage()
	currentSection := ""

	for _, q := range questions {
		if q.AnswerText == "" {
			continue
		}

		sectionStr := ""
		if q.Section != nil {
			sectionStr = *q.Section
		}

		// Section header
		if sectionStr != "" && sectionStr != currentSection {
			currentSection = sectionStr
			pdf.Ln(6)
			pdf.SetFont("Helvetica", "B", 16)
			pdf.SetTextColor(26, 39, 64) // navy #1a2740
			pdf.MultiCell(0, 8, toUTF8Safe(currentSection), "", "", false)

			// Underline
			pdf.SetDrawColor(45, 95, 160) // brand-blue #2d5fa0
			pdf.SetLineWidth(0.5)
			x := pdf.GetX()
			y := pdf.GetY()
			pdf.Line(x, y, x+170, y)
			pdf.Ln(6)
			pdf.SetTextColor(0, 0, 0)
		}

		// Question (bold)
		qLabel := ""
		if q.QuestionNumber != nil {
			qLabel = fmt.Sprintf("Q%d: ", *q.QuestionNumber)
		}
		pdf.SetFont("Helvetica", "B", 11)
		pdf.MultiCell(0, 6, toUTF8Safe(qLabel+q.QuestionText), "", "", false)
		pdf.Ln(3)

		// Answer
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(0, 5, toUTF8Safe(q.AnswerText), "", "", false)
		pdf.Ln(2)

		// Status
		label := statusLabel(q.Status)
		if label != "" {
			switch q.Status {
			case "approved":
				pdf.SetTextColor(46, 125, 50)
			case "in_review":
				pdf.SetTextColor(245, 127, 23)
			case "rejected":
				pdf.SetTextColor(198, 40, 40)
			default:
				pdf.SetTextColor(100, 100, 100)
			}
			pdf.SetFont("Helvetica", "B", 9)
			pdf.CellFormat(0, 5, fmt.Sprintf("[%s]", label), "", 1, "", false, 0, "")
			pdf.SetTextColor(0, 0, 0)
			pdf.Ln(1)
		}

		// Citations
		if len(q.Citations) > 0 {
			pdf.SetFont("Helvetica", "I", 9)
			pdf.SetTextColor(120, 120, 120)
			citText := "Sources: " + strings.Join(q.Citations, "; ")
			pdf.MultiCell(0, 4, toUTF8Safe(citText), "", "", false)
			pdf.SetTextColor(0, 0, 0)
			pdf.Ln(2)
		}

		// Separator line
		pdf.SetDrawColor(220, 220, 220)
		pdf.SetLineWidth(0.2)
		x := pdf.GetX()
		y := pdf.GetY()
		pdf.Line(x, y, x+170, y)
		pdf.Ln(6)
	}

	var pdfBuf bytes.Buffer
	if err := pdf.Output(&pdfBuf); err != nil {
		log.Printf("error writing pdf: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	filename := sanitizeFilename(projectName)
	c.Response().Header().Set("Content-Type", "application/pdf")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.pdf"`, filename))
	return c.Blob(http.StatusOK, "application/pdf", pdfBuf.Bytes())
}

// toUTF8Safe sanitizes strings for gofpdf which uses Windows-1252 by default.
func toUTF8Safe(s string) string {
	replacer := strings.NewReplacer(
		"\u2018", "'", "\u2019", "'",
		"\u201C", "\"", "\u201D", "\"",
		"\u2013", "-", "\u2014", "--",
		"\u2026", "...", "\u00A0", " ",
	)
	return replacer.Replace(s)
}

// ---------------------------------------------------------------------------
// XLSX Export — using excelize
// ---------------------------------------------------------------------------

// ExportXLSX handles POST /api/rfp/:id/export/xlsx
func (h *Handler) ExportXLSX(c echo.Context) error {
	orgID := getOrgID(c)
	projectID := c.Param("id")

	projectName, questions, err := h.getExportData(orgID, projectID)
	if err != nil {
		log.Printf("error building export content: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := "RFP Responses"
	idx, _ := f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(idx)

	// Header style: bold with background color
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Size:  11,
			Color: "FFFFFF",
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"1A2740"},
			Pattern: 1,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
			WrapText:   true,
		},
		Border: []excelize.Border{
			{Type: "bottom", Color: "2D5FA0", Style: 2},
		},
	})

	// Data cell style with word wrap
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Vertical: "top",
			WrapText: true,
		},
	})

	// Header row
	headers := []string{"#", "Section", "Question", "Mandatory", "Answer", "Status", "Confidence", "Sources"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
	}

	// Data rows
	row := 2
	for _, q := range questions {
		numStr := ""
		if q.QuestionNumber != nil {
			numStr = itoa(*q.QuestionNumber)
		}
		sectionStr := ""
		if q.Section != nil {
			sectionStr = *q.Section
		}
		mandatoryStr := "No"
		if q.IsMandatory {
			mandatoryStr = "Yes"
		}
		answerText := q.AnswerText
		label := statusLabel(q.Status)
		if label == "" {
			label = q.Status
		}
		citationsStr := strings.Join(q.Citations, "; ")

		values := []interface{}{
			numStr,
			sectionStr,
			q.QuestionText,
			mandatoryStr,
			answerText,
			label,
			fmt.Sprintf("%.0f%%", q.Confidence*100),
			citationsStr,
		}
		for i, val := range values {
			cell, _ := excelize.CoordinatesToCellName(i+1, row)
			f.SetCellValue(sheet, cell, val)
			f.SetCellStyle(sheet, cell, cell, dataStyle)
		}
		row++
	}

	// Set column widths for readability
	colWidths := map[string]float64{
		"A": 6,   // #
		"B": 20,  // Section
		"C": 40,  // Question
		"D": 12,  // Mandatory
		"E": 60,  // Answer
		"F": 14,  // Status
		"G": 12,  // Confidence
		"H": 40,  // Sources
	}
	for col, width := range colWidths {
		f.SetColWidth(sheet, col, col, width)
	}

	// Freeze the header row
	f.SetPanes(sheet, &excelize.Panes{
		Freeze:      true,
		Split:       false,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		log.Printf("error writing xlsx: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "export failed"})
	}

	filename := sanitizeFilename(projectName)
	c.Response().Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.xlsx"`, filename))
	return c.Blob(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}

// ---------------------------------------------------------------------------
// Helpers (kept from original)
// ---------------------------------------------------------------------------

func repeatChar(ch byte, count int) string {
	b := make([]byte, count)
	for i := range b {
		b[i] = ch
	}
	return string(b)
}

func sanitizeFilename(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			result = append(result, c)
		} else if c == ' ' {
			result = append(result, '_')
		}
	}
	if len(result) == 0 {
		return "export"
	}
	return string(result)
}
