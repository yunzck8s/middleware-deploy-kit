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

	// 离线包管理 API
	packageAPI := api.NewPackageAPI(cfg)
	packages := v1.Group("/packages")
	packages.Use(api.AuthMiddleware(cfg))
	{
		packages.POST("", packageAPI.Upload)                // 上传离线包
		packages.GET("", packageAPI.List)                   // 获取离线包列表
		packages.GET("/:id", packageAPI.Get)                // 获取离线包详情
		packages.GET("/:id/metadata", packageAPI.GetMetadata) // 获取离线包元数据
		packages.DELETE("/:id", packageAPI.Delete)          // 删除离线包
	}

	// 证书管理 API
	certAPI := api.NewCertificateAPI(cfg)
	certificates := v1.Group("/certificates")
	certificates.Use(api.AuthMiddleware(cfg))
	{
		certificates.POST("", certAPI.Upload)                  // 上传证书
		certificates.GET("", certAPI.List)                     // 获取证书列表
		certificates.GET("/:id", certAPI.Get)                  // 获取证书详情
		certificates.GET("/:id/download", certAPI.Download)    // 下载证书文件
		certificates.DELETE("/:id", certAPI.Delete)            // 删除证书
	}

	// 服务器管理 API
	serverAPI := api.NewServerAPI(cfg)
	servers := v1.Group("/servers")
	servers.Use(api.AuthMiddleware(cfg))
	{
		servers.POST("", serverAPI.Create)                       // 创建服务器
		servers.GET("", serverAPI.List)                          // 获取服务器列表
		servers.GET("/:id", serverAPI.Get)                       // 获取服务器详情
		servers.PUT("/:id", serverAPI.Update)                    // 更新服务器
		servers.DELETE("/:id", serverAPI.Delete)                 // 删除服务器
		servers.POST("/:id/test", serverAPI.TestConnection)      // 测试已保存服务器连接
		servers.POST("/test", serverAPI.TestConnectionDirect)    // 直接测试连接（不保存）
	}

	// Nginx 配置 API
	nginxAPI := api.NewNginxAPI(cfg)
	nginx := v1.Group("/nginx")
	nginx.Use(api.AuthMiddleware(cfg))
	{
		nginx.POST("", nginxAPI.Create)                // 创建 Nginx 配置
		nginx.GET("", nginxAPI.List)                   // 获取配置列表
		nginx.GET("/:id", nginxAPI.Get)                // 获取配置详情
		nginx.PUT("/:id", nginxAPI.Update)             // 更新配置
		nginx.DELETE("/:id", nginxAPI.Delete)          // 删除配置
		nginx.GET("/:id/generate", nginxAPI.Generate)  // 生成配置文件
		nginx.POST("/preview", nginxAPI.Preview)       // 预览配置（不保存）
	}

	// 部署管理 API
	deploymentAPI := api.NewDeploymentAPI(cfg)
	deployments := v1.Group("/deployments")
	deployments.Use(api.AuthMiddleware(cfg))
	{
		deployments.POST("", deploymentAPI.Create)                    // 创建部署任务
		deployments.POST("/batch", deploymentAPI.BatchCreate)         // 批量创建部署任务
		deployments.GET("", deploymentAPI.List)                       // 获取部署任务列表
		deployments.GET("/:id", deploymentAPI.Get)                    // 获取部署任务详情
		deployments.DELETE("/:id", deploymentAPI.Delete)              // 删除部署任务
		deployments.POST("/:id/execute", deploymentAPI.Execute)       // 执行部署任务
		deployments.POST("/:id/rollback", deploymentAPI.Rollback)     // 回滚部署
		deployments.GET("/:id/logs", deploymentAPI.GetLogs)           // 获取部署日志
	}

	// 部署脚本管理 API
	scriptAPI := api.NewDeploymentScriptAPI(cfg)
	scripts := v1.Group("/scripts")
	scripts.Use(api.AuthMiddleware(cfg))
	{
		scripts.POST("", scriptAPI.Create)         // 创建脚本模板
		scripts.GET("", scriptAPI.List)            // 获取脚本模板列表
		scripts.GET("/:id", scriptAPI.Get)         // 获取脚本模板详情
		scripts.PUT("/:id", scriptAPI.Update)      // 更新脚本模板
		scripts.DELETE("/:id", scriptAPI.Delete)   // 删除脚本模板
	}

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "服务运行正常",
		})
	})
}

// ensureDataDirs 确保数据目录存在
func ensureDataDirs(cfg *config.Config) {
	dirs := []string{
		cfg.Data.Packages,
		cfg.Data.Certificates,
		cfg.Data.Logs,
		cfg.Data.UploadDir,
		filepath.Dir(cfg.Database.DSN),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			logger.Fatalf("创建数据目录失败 %s: %v", dir, err)
		}
	}

	logger.Info("数据目录检查完成")
}
