package main

import (
	"backend/internal/fetch"
	"encoding/json"
	"fmt"
	"log"
)

func main() {
	log.Println("Testing FetchFunds...")
	funds, err := fetch.FetchFunds()
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	data, _ := json.MarshalIndent(funds, "", "  ")
	fmt.Println(string(data))
}
