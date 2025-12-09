package models

type Fund struct {
	Symbol  string    `json:"symbol"`
	Name    string    `json:"name"`
	Price   float64   `json:"price"`
	Change  float64   `json:"change"`
	Open    float64   `json:"open"`
	History []float64 `json:"history"`
}
