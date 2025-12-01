package config

import (
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
	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Database: DatabaseConfig{
			Type: "sqlite",
			DSN:  "./data/deploy.db",
		},
		JWT: JWTConfig{
			Secret:     "your-secret-key-change-in-production",
			ExpireTime: 24 * time.Hour,
		},
		Data: DataConfig{
			Packages:     "./data/packages",
			Certificates: "./data/certificates",
			Logs:         "./data/logs",
			UploadDir:    "./data/uploads",
		},
	}
}
