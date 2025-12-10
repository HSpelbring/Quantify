package fetch

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

type SearchResult struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
	Type     string `json:"typeDisp"`
}

type YahooQuote struct {
	Symbol    string `json:"symbol"`
	Shortname string `json:"shortname"`
	Exchange  string `json:"exchange"`
	QuoteType string `json:"quoteType"`
}

type YahooSearchResponse struct {
	Quotes []YahooQuote `json:"quotes"`
}

// SearchSymbols queries Yahoo Finance for autocomplete suggestions
func SearchSymbols(query string) ([]SearchResult, error) {
	if query == "" {
		return []SearchResult{}, nil
	}

	// Use modern Query2 API
	endpoint := fmt.Sprintf("https://query2.finance.yahoo.com/v1/finance/search?q=%s&quotesCount=10&newsCount=0", url.QueryEscape(query))

	// Create client with user agent (sometimes required by Yahoo)
	client := &http.Client{}
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo api returned status: %d", resp.StatusCode)
	}

	var yResp YahooSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&yResp); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(yResp.Quotes))
	for _, q := range yResp.Quotes {
		// Filter out unrelated things if needed, or just map them
		results = append(results, SearchResult{
			Symbol:   q.Symbol,
			Name:     q.Shortname,
			Exchange: q.Exchange,
			Type:     q.QuoteType,
		})
	}

	return results, nil
}
