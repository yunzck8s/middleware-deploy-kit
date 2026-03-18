package config

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"strconv"
	"time"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	Data     DataConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host string
	Port int
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Type string
	DSN  string
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret     string
	ExpireTime time.Duration
}

// DataConfig 数据目录配置
type DataConfig struct {
	Packages     string
	Certificates string
	Logs         string
	UploadDir    string
}

// NewConfig 创建默认配置
func NewConfig() *Config {
	dataDir := getEnv("DATA_DIR", "./data")
	return &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnvInt("SERVER_PORT", 9090),
		},
		Database: DatabaseConfig{
			Type: "sqlite",
			DSN:  dataDir + "/deploy.db",
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", generateSecret()),
			ExpireTime: 24 * time.Hour,
		},
		Data: DataConfig{
			Packages:     dataDir + "/packages",
			Certificates: dataDir + "/certificates",
			Logs:         dataDir + "/logs",
			UploadDir:    dataDir + "/uploads",
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func generateSecret() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
