package main

import (
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/api"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
)

func main() {
	// 初始化日志
	logger.Init()
	logger.Info("=== 中间件离线部署管理平台启动中 ===")

	// 加载配置
	cfg := config.NewConfig()

	// 确保数据目录存在
	ensureDataDirs(cfg)

	// 初始化数据库
	if err := db.Init(cfg); err != nil {
		logger.Fatalf("数据库初始化失败: %v", err)
	}
	defer db.Close()

	// 创建Gin引擎
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// 注册中间件
	r.Use(api.CORS())

	// 注册路由
	setupRoutes(r, cfg)

	// 启动服务器
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	logger.Infof("服务器启动成功，监听地址: %s", addr)
	logger.Info("默认管理员账号: admin / admin123")

	// 优雅关闭
	go func() {
		if err := r.Run(addr); err != nil {
			logger.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("正在关闭服务器...")
	logger.Info("服务器已关闭")
}

// setupRoutes 设置路由
func setupRoutes(r *gin.Engine, cfg *config.Config) {
	// API版本分组
	v1 := r.Group("/api/v1")

	// 认证API
	authAPI := api.NewAuthAPI(cfg)
	auth := v1.Group("/auth")
	{
		auth.POST("/login", authAPI.Login)
		auth.POST("/logout", authAPI.Logout)

		// 需要认证的路由
		authRoutes := auth.Group("")
		authRoutes.Use(api.AuthMiddleware(cfg))
		{
			authRoutes.GET("/profile", authAPI.GetProfile)
			authRoutes.PUT("/password", authAPI.ChangePassword)
		}
	}

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"message": "服务运行正常",
		})
	})

	// 后续添加其他API路由
	// - 离线包管理
	// - 证书管理
	// - Nginx配置
	// - 服务器管理
	// - 部署管理
	// - 部署历史
}

// ensureDataDirs 确保数据目录存在
func ensureDataDirs(cfg *config.Config) {
	dirs := []string{
		cfg.Data.Packages,
		cfg.Data.Certificates,
		cfg.Data.Logs,
		filepath.Dir(cfg.Database.DSN),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			logger.Fatalf("创建数据目录失败 %s: %v", dir, err)
		}
	}

	logger.Info("数据目录检查完成")
}
