package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"backend/internal/api"
)

func main() {
	router := gin.Default()

	// Register routes from internal/api/routes.go
	router.Use(cors.Default())
	api.RegisterRoutes(router)

	db.InitDB()
	log.Println("Starting Go backend on port 8080...")
	router.Run(":8080")
}
