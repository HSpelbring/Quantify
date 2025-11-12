package main

import (
	"backend/internal/api"
	"backend/internal/db"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	router := gin.Default()
	router.Use(cors.Default())
	err := db.InitDB()
	if err != nil {
		log.Fatalf("❌ Failed to initialize database: %v", err)
	}

	api.RegisterRoutes(router)
	log.Println("Starting Go backend on port 8080...")
	router.Run(":8080")
}
