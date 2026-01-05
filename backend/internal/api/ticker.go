package api

import (
	"backend/internal/fetch"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
)

// Funds are now handled by the fetch package

func HandleFunds(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	// Parse optional symbols param
	var requestedSymbols []string
	querySym := r.URL.Query().Get("symbols")
	if querySym != "" {
		requestedSymbols = strings.Split(querySym, ",")
	}

	// Use shared logic from fetch package
	funds, err := fetch.FetchFunds(requestedSymbols)
	if err != nil {
		log.Printf("Error fetching funds: %v", err)
		// Try to return partial data or error
		http.Error(w, fmt.Sprintf("Failed to fetch funds: %v", err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(funds)
}
