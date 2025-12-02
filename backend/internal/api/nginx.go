package api

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/sftp"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
	"golang.org/x/crypto/ssh"
)

// NginxAPI Nginx 配置 API
type NginxAPI struct {
	cfg *config.Config
}

// NewNginxAPI 创建 Nginx API 实例
func NewNginxAPI(cfg *config.Config) *NginxAPI {
	return &NginxAPI{cfg: cfg}
}

// CreateNginxConfigRequest 创建 Nginx 配置请求
type CreateNginxConfigRequest struct {
	Name              string `json:"name" binding:"required"`
	Description       string `json:"description"`
	ServerID          *uint  `json:"server_id"`
	WorkerProcesses   string `json:"worker_processes"`
	WorkerConnections int    `json:"worker_connections"`
	EnableHTTP        bool   `json:"enable_http"`
	HTTPPort          int    `json:"http_port"`
	EnableHTTPS       bool   `json:"enable_https"`
	HTTPSPort         int    `json:"https_port"`
	CertificateID     *uint  `json:"certificate_id"`
	HTTPToHTTPS       bool   `json:"http_to_https"`
	ServerName        string `json:"server_name"`
	RootPath          string `json:"root_path"`
	IndexFiles        string `json:"index_files"`
	AccessLogPath     string `json:"access_log_path"`
	ErrorLogPath      string `json:"error_log_path"`
	LogFormat         string `json:"log_format"`
	EnableProxy       bool   `json:"enable_proxy"`
	ProxyPass         string                 `json:"proxy_pass"`
	Locations         []models.NginxLocation `json:"locations"`
	ClientMaxBodySize string                 `json:"client_max_body_size"`
	Gzip              bool                   `json:"gzip"`
	CustomConfig      string                 `json:"custom_config"`
}

// Create 创建 Nginx 配置
func (n *NginxAPI) Create(c *gin.Context) {
	var req CreateNginxConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 检查名称是否已存在
	var existing models.NginxConfig
	if db.DB.Where("name = ?", req.Name).First(&existing).Error == nil {
		response.Conflict(c, "配置名称已存在")
		return
	}

	// 如果启用 HTTPS，验证证书
	if req.EnableHTTPS && req.CertificateID == nil {
		response.BadRequest(c, "启用 HTTPS 需要选择证书")
		return
	}

	cfg := &models.NginxConfig{
		Name:              req.Name,
		Description:       req.Description,
		ServerID:          req.ServerID,
		WorkerProcesses:   defaultString(req.WorkerProcesses, "auto"),
		WorkerConnections: defaultInt(req.WorkerConnections, 1024),
		EnableHTTP:        req.EnableHTTP,
		HTTPPort:          defaultInt(req.HTTPPort, 80),
		EnableHTTPS:       req.EnableHTTPS,
		HTTPSPort:         defaultInt(req.HTTPSPort, 443),
		CertificateID:     req.CertificateID,
		HTTPToHTTPS:       req.HTTPToHTTPS,
		ServerName:        defaultString(req.ServerName, "_"),
		RootPath:          defaultString(req.RootPath, "/usr/share/nginx/html"),
		IndexFiles:        defaultString(req.IndexFiles, "index.html index.htm"),
		AccessLogPath:     defaultString(req.AccessLogPath, "/var/log/nginx/access.log"),
		ErrorLogPath:      defaultString(req.ErrorLogPath, "/var/log/nginx/error.log"),
		LogFormat:         defaultString(req.LogFormat, "main"),
		EnableProxy:       req.EnableProxy,
		ProxyPass:         req.ProxyPass,
		ClientMaxBodySize: defaultString(req.ClientMaxBodySize, "100m"),
		Gzip:              req.Gzip,
		CustomConfig:      req.CustomConfig,
		Status:            "draft",
	}

	// 使用事务创建配置和 locations
	tx := db.DB.Begin()
	if err := tx.Create(cfg).Error; err != nil {
		tx.Rollback()
		logger.Errorf("创建 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "创建失败")
		return
	}

	// 保存 locations
	if len(req.Locations) > 0 {
		for i, loc := range req.Locations {
			loc.NginxConfigID = cfg.ID
			loc.SortOrder = i
			if err := tx.Create(&loc).Error; err != nil {
				tx.Rollback()
				logger.Errorf("创建 Location 失败: %v", err)
				response.InternalServerError(c, "创建 Location 失败")
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		logger.Errorf("提交事务失败: %v", err)
		response.InternalServerError(c, "创建失败")
		return
	}

	// 重新加载带 locations 的配置
	db.DB.Preload("Locations").First(cfg, cfg.ID)

	logger.Infof("Nginx 配置创建成功: %s", cfg.Name)
	response.SuccessWithMessage(c, "创建成功", cfg)
}

// List 获取 Nginx 配置列表
func (n *NginxAPI) List(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var configs []models.NginxConfig
	query := db.DB.Model(&models.NginxConfig{}).Preload("Server").Preload("Certificate").Preload("Locations")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&configs).Error; err != nil {
		logger.Errorf("查询 Nginx 配置列表失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"configs":   configs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// Get 获取 Nginx 配置详情
func (n *NginxAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cfg models.NginxConfig
	if err := db.DB.Preload("Server").Preload("Certificate").Preload("Locations").First(&cfg, id).Error; err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	response.Success(c, cfg)
}

// Update 更新 Nginx 配置
func (n *NginxAPI) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cfg models.NginxConfig
	if err := db.DB.First(&cfg, id).Error; err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	var req CreateNginxConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 更新字段
	cfg.Name = req.Name
	cfg.Description = req.Description
	cfg.ServerID = req.ServerID
	cfg.WorkerProcesses = req.WorkerProcesses
	cfg.WorkerConnections = req.WorkerConnections
	cfg.EnableHTTP = req.EnableHTTP
	cfg.HTTPPort = req.HTTPPort
	cfg.EnableHTTPS = req.EnableHTTPS
	cfg.HTTPSPort = req.HTTPSPort
	cfg.CertificateID = req.CertificateID
	cfg.HTTPToHTTPS = req.HTTPToHTTPS
	cfg.ServerName = req.ServerName
	cfg.RootPath = req.RootPath
	cfg.IndexFiles = req.IndexFiles
	cfg.AccessLogPath = req.AccessLogPath
	cfg.ErrorLogPath = req.ErrorLogPath
	cfg.LogFormat = req.LogFormat
	cfg.EnableProxy = req.EnableProxy
	cfg.ProxyPass = req.ProxyPass
	cfg.ClientMaxBodySize = req.ClientMaxBodySize
	cfg.Gzip = req.Gzip
	cfg.CustomConfig = req.CustomConfig

	// 使用事务更新配置和 locations
	tx := db.DB.Begin()
	if err := tx.Save(&cfg).Error; err != nil {
		tx.Rollback()
		logger.Errorf("更新 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "更新失败")
		return
	}

	// 删除旧的 locations
	if err := tx.Where("nginx_config_id = ?", cfg.ID).Delete(&models.NginxLocation{}).Error; err != nil {
		tx.Rollback()
		logger.Errorf("删除旧 Locations 失败: %v", err)
		response.InternalServerError(c, "更新失败")
		return
	}

	// 创建新的 locations
	if len(req.Locations) > 0 {
		for i, loc := range req.Locations {
			loc.ID = 0 // 清除 ID，作为新记录插入
			loc.NginxConfigID = cfg.ID
			loc.SortOrder = i
			if err := tx.Create(&loc).Error; err != nil {
				tx.Rollback()
				logger.Errorf("创建新 Location 失败: %v", err)
				response.InternalServerError(c, "更新 Location 失败")
				return
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		logger.Errorf("提交事务失败: %v", err)
		response.InternalServerError(c, "更新失败")
		return
	}

	// 重新加载带 locations 的配置
	db.DB.Preload("Locations").First(&cfg, cfg.ID)

	logger.Infof("Nginx 配置更新成功: %s (ID: %d)", cfg.Name, cfg.ID)
	response.SuccessWithMessage(c, "更新成功", cfg)
}

// Delete 删除 Nginx 配置
func (n *NginxAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cfg models.NginxConfig
	if err := db.DB.First(&cfg, id).Error; err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	if err := db.DB.Delete(&cfg).Error; err != nil {
		logger.Errorf("删除 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

	logger.Infof("Nginx 配置已删除: %s (ID: %d)", cfg.Name, cfg.ID)
	response.SuccessWithMessage(c, "删除成功", nil)
}

// Generate 生成 Nginx 配置文件内容
func (n *NginxAPI) Generate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cfg models.NginxConfig
	if err := db.DB.Preload("Certificate").Preload("Locations").First(&cfg, id).Error; err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	content, err := generateNginxConfig(&cfg)
	if err != nil {
		logger.Errorf("生成 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "生成配置失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"config":  cfg,
		"content": content,
	})
}

// Preview 预览 Nginx 配置（不保存）
func (n *NginxAPI) Preview(c *gin.Context) {
	var req CreateNginxConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	cfg := &models.NginxConfig{
		Name:              req.Name,
		WorkerProcesses:   defaultString(req.WorkerProcesses, "auto"),
		WorkerConnections: defaultInt(req.WorkerConnections, 1024),
		EnableHTTP:        req.EnableHTTP,
		HTTPPort:          defaultInt(req.HTTPPort, 80),
		EnableHTTPS:       req.EnableHTTPS,
		HTTPSPort:         defaultInt(req.HTTPSPort, 443),
		HTTPToHTTPS:       req.HTTPToHTTPS,
		ServerName:        defaultString(req.ServerName, "_"),
		RootPath:          defaultString(req.RootPath, "/usr/share/nginx/html"),
		IndexFiles:        defaultString(req.IndexFiles, "index.html index.htm"),
		AccessLogPath:     defaultString(req.AccessLogPath, "/var/log/nginx/access.log"),
		ErrorLogPath:      defaultString(req.ErrorLogPath, "/var/log/nginx/error.log"),
		LogFormat:         defaultString(req.LogFormat, "main"),
		EnableProxy:       req.EnableProxy,
		ProxyPass:         req.ProxyPass,
		ClientMaxBodySize: defaultString(req.ClientMaxBodySize, "100m"),
		Gzip:              req.Gzip,
		CustomConfig:      req.CustomConfig,
	}

	// 如果有证书 ID，加载证书信息
	if req.CertificateID != nil {
		var cert models.Certificate
		if err := db.DB.First(&cert, *req.CertificateID).Error; err == nil {
			cfg.Certificate = &cert
		}
	}

	// 处理 locations
	cfg.Locations = req.Locations
	logger.Infof("预览配置 - EnableProxy: %v, Locations 数量: %d, Locations: %+v", req.EnableProxy, len(req.Locations), req.Locations)

	content, err := generateNginxConfig(cfg)
	if err != nil {
		logger.Errorf("生成 Nginx 配置预览失败: %v", err)
		response.InternalServerError(c, "生成配置失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"content": content,
	})
}

// generateNginxConfig 生成 Nginx 配置文件内容
func generateNginxConfig(cfg *models.NginxConfig) (string, error) {
	tmpl := `# Nginx 配置文件
# 由中间件部署平台自动生成
# 配置名称: {{.Name}}

user nobody;
worker_processes {{.WorkerProcesses}};
error_log {{.ErrorLogPath}} warn;
pid /var/run/nginx.pid;

events {
    worker_connections {{.WorkerConnections}};
    use epoll;
    multi_accept on;
}

http {
    include mime.types;
    default_type application/octet-stream;

    # 日志格式
{{if eq .LogFormat "json"}}
    log_format json escape=json '{'
        '"time_local":"$time_local",'
        '"remote_addr":"$remote_addr",'
        '"remote_user":"$remote_user",'
        '"request":"$request",'
        '"status":"$status",'
        '"body_bytes_sent":"$body_bytes_sent",'
        '"request_time":"$request_time",'
        '"http_referrer":"$http_referer",'
        '"http_user_agent":"$http_user_agent",'
        '"http_x_forwarded_for":"$http_x_forwarded_for"'
    '}';
    access_log {{.AccessLogPath}} json;
{{else}}
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log {{.AccessLogPath}} main;
{{end}}

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    client_max_body_size {{.ClientMaxBodySize}};

{{if .Gzip}}
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
{{end}}

{{if .EnableHTTP}}
    # HTTP Server
    server {
        listen {{.HTTPPort}};
        server_name {{.ServerName}};
{{if .HTTPToHTTPS}}
        return 301 https://$host$request_uri;
{{else}}
        root {{.RootPath}};
        index {{.IndexFiles}};

{{if .EnableProxy}}
{{if .Locations}}{{range .Locations}}
        location {{.Path}} {
{{if .ProxyPass}}
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
{{end}}
{{if .Root}}
            root {{.Root}};
{{end}}
{{if .TryFiles}}
            try_files {{.TryFiles}};
{{else}}{{if and (not .ProxyPass) (not .Root)}}
            try_files $uri $uri/ =404;
{{end}}{{end}}
        }
{{end}}{{else}}
        location / {
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
{{end}}
{{else}}
        location / {
            try_files $uri $uri/ =404;
        }
{{end}}
{{end}}
    }
{{end}}

{{if .EnableHTTPS}}
    # HTTPS Server
    server {
        listen {{.HTTPSPort}} ssl http2;
        server_name {{.ServerName}};

        ssl_certificate {{if .Certificate}}{{.Certificate.CertFilePath}}{{else}}/etc/nginx/ssl/cert.crt{{end}};
        ssl_certificate_key {{if .Certificate}}{{.Certificate.KeyFilePath}}{{else}}/etc/nginx/ssl/cert.key{{end}};

        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        root {{.RootPath}};
        index {{.IndexFiles}};

{{if .EnableProxy}}
{{if .Locations}}{{range .Locations}}
        location {{.Path}} {
{{if .ProxyPass}}
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
{{end}}
{{if .Root}}
            root {{.Root}};
{{end}}
{{if .TryFiles}}
            try_files {{.TryFiles}};
{{else}}{{if and (not .ProxyPass) (not .Root)}}
            try_files $uri $uri/ =404;
{{end}}{{end}}
        }
{{end}}{{else}}
        location / {
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
{{end}}
{{else}}
        location / {
            try_files $uri $uri/ =404;
        }
{{end}}
    }
{{end}}

{{if .CustomConfig}}
    # 自定义配置
{{.CustomConfig}}
{{end}}
}
`

	t, err := template.New("nginx").Parse(tmpl)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, cfg); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func defaultString(s, def string) string {
	if s == "" {
		return def
	}
	return s
}

func defaultInt(n, def int) int {
	if n == 0 {
		return def
	}
	return n
}

// ApplyConfigRequest 应用配置请求
type ApplyConfigRequest struct {
	ServerID       uint   `json:"server_id" binding:"required"`
	TargetPath     string `json:"target_path"`
	BackupEnabled  bool   `json:"backup_enabled"`
	RestartService bool   `json:"restart_service"`
	ServiceName    string `json:"service_name"`
}

// ApplyConfig 应用 Nginx 配置到服务器
func (n *NginxAPI) ApplyConfig(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var req ApplyConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 验证配置存在
	var cfg models.NginxConfig
	if err := db.DB.Preload("Certificate").Preload("Locations").First(&cfg, id).Error; err != nil {
		response.NotFound(c, "配置不存在")
		return
	}

	// 验证服务器存在
	var server models.Server
	if err := db.DB.First(&server, req.ServerID).Error; err != nil {
		response.NotFound(c, "服务器不存在")
		return
	}

	// 创建应用记录
	apply := &models.NginxConfigApply{
		NginxConfigID:  uint(id),
		ServerID:       req.ServerID,
		TargetPath:     defaultString(req.TargetPath, "/etc/nginx/nginx.conf"),
		BackupEnabled:  req.BackupEnabled,
		RestartService: req.RestartService,
		ServiceName:    defaultString(req.ServiceName, "nginx"),
		Status:         "pending",
	}

	if err := db.DB.Create(apply).Error; err != nil {
		logger.Errorf("创建配置应用记录失败: %v", err)
		response.InternalServerError(c, "创建失败")
		return
	}

	// 异步执行配置应用
	go n.executeApplyConfig(apply.ID, &cfg, &server)

	logger.Infof("Nginx 配置应用任务已创建: %d", apply.ID)
	response.SuccessWithMessage(c, "配置应用任务已创建", apply)
}

// GetApplyHistory 获取配置应用历史
func (n *NginxAPI) GetApplyHistory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var applies []models.NginxConfigApply
	query := db.DB.Where("nginx_config_id = ?", id).
		Preload("Server").
		Order("created_at DESC")

	var total int64
	query.Model(&models.NginxConfigApply{}).Count(&total)

	offset := (page - 1) * pageSize
	if err := query.Limit(pageSize).Offset(offset).Find(&applies).Error; err != nil {
		logger.Errorf("查询配置应用历史失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"applies":   applies,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetApplyDetail 获取应用详情（包含日志）
func (n *NginxAPI) GetApplyDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var apply models.NginxConfigApply
	if err := db.DB.Preload("Server").
		Preload("NginxConfig").
		Preload("Logs").
		First(&apply, id).Error; err != nil {
		response.NotFound(c, "应用记录不存在")
		return
	}

	response.Success(c, apply)
}

// executeApplyConfig 执行配置应用
func (n *NginxAPI) executeApplyConfig(applyID uint, cfg *models.NginxConfig, server *models.Server) {
	// 更新状态为 running
	startTime := now()
	db.DB.Model(&models.NginxConfigApply{}).Where("id = ?", applyID).Updates(map[string]interface{}{
		"status":     "running",
		"start_time": startTime,
	})

	var finalStatus = "success"
	var errorMsg string

	defer func() {
		endTime := now()
		duration := int(endTime.Sub(*startTime).Seconds())

		db.DB.Model(&models.NginxConfigApply{}).Where("id = ?", applyID).Updates(map[string]interface{}{
			"status":    finalStatus,
			"end_time":  endTime,
			"duration":  duration,
			"error_msg": errorMsg,
		})
	}()

	// 加载完整的应用记录
	var apply models.NginxConfigApply
	if err := db.DB.First(&apply, applyID).Error; err != nil {
		logger.Errorf("加载应用记录失败: %v", err)
		finalStatus = "failed"
		errorMsg = "加载应用记录失败"
		return
	}

	// 步骤1: 生成配置文件
	n.addApplyLog(applyID, 1, "生成 Nginx 配置文件", "running", "", "")
	content, err := generateNginxConfig(cfg)
	if err != nil {
		logger.Errorf("生成配置文件失败: %v", err)
		n.addApplyLog(applyID, 1, "生成 Nginx 配置文件", "failed", "", err.Error())
		finalStatus = "failed"
		errorMsg = "生成配置文件失败"
		return
	}
	n.addApplyLog(applyID, 1, "生成 Nginx 配置文件", "success", "配置文件生成成功", "")

	// 步骤2: 连接到目标服务器
	n.addApplyLog(applyID, 2, "连接到目标服务器", "running", "", "")
	sshClient, sftpClient, err := connectToServer(server)
	if err != nil {
		logger.Errorf("连接服务器失败: %v", err)
		n.addApplyLog(applyID, 2, "连接到目标服务器", "failed", "", err.Error())
		finalStatus = "failed"
		errorMsg = "连接服务器失败"
		return
	}
	defer sshClient.Close()
	defer sftpClient.Close()
	n.addApplyLog(applyID, 2, "连接到目标服务器", "success", "SSH 连接建立成功", "")

	// 确定目标文件完整路径（提前计算，供后续步骤使用）
	targetFile := apply.TargetPath
	// 如果目标路径不以 .conf 结尾，说明是目录，需要添加文件名
	if !strings.HasSuffix(targetFile, ".conf") {
		targetFile = filepath.Join(targetFile, "nginx.conf")
	}

	// 步骤3: 备份原配置（如果启用）
	if apply.BackupEnabled {
		n.addApplyLog(applyID, 3, "备份原配置文件", "running", "", "")
		backupPath := targetFile + ".backup." + startTime.Format("20060102150405")

		// 检查原文件是否存在
		checkCmd := "test -f " + targetFile + " && echo exists || echo notexists"
		session, _ := sshClient.NewSession()
		output, _ := session.CombinedOutput(checkCmd)
		session.Close()

		if string(output) == "exists\n" {
			cpCmd := "sudo cp " + targetFile + " " + backupPath
			session, _ := sshClient.NewSession()
			cpOutput, err := session.CombinedOutput(cpCmd)
			session.Close()
			if err != nil {
				cpOutputStr := string(cpOutput)
				logger.Errorf("备份配置文件失败: %v, 输出: %s", err, cpOutputStr)
				n.addApplyLog(applyID, 3, "备份原配置文件", "failed", cpOutputStr, err.Error())
				finalStatus = "failed"
				errorMsg = "备份配置失败"
				return
			}

			// 验证备份文件是否真的存在
			verifyCmd := "ls -lh " + backupPath + " 2>&1"
			session, _ = sshClient.NewSession()
			verifyOutput, verifyErr := session.CombinedOutput(verifyCmd)
			session.Close()
			verifyOutputStr := string(verifyOutput)
			logger.Infof("备份文件验证: %s", verifyOutputStr)

			if verifyErr != nil {
				logger.Errorf("备份验证失败 - 文件不存在: %s", backupPath)
				n.addApplyLog(applyID, 3, "备份原配置文件", "failed", "备份文件验证失败: "+verifyOutputStr, "文件未创建")
				finalStatus = "failed"
				errorMsg = "备份验证失败"
				return
			}

			// 更新备份路径
			db.DB.Model(&models.NginxConfigApply{}).Where("id = ?", applyID).Update("backup_path", backupPath)
			n.addApplyLog(applyID, 3, "备份原配置文件", "success", "备份至: "+backupPath+"\n验证: "+verifyOutputStr, "")
		} else {
			n.addApplyLog(applyID, 3, "备份原配置文件", "success", "原文件不存在，跳过备份", "")
		}
	}

	// 步骤4: 上传新配置文件
	stepNum := 4
	if !apply.BackupEnabled {
		stepNum = 3
	}
	n.addApplyLog(applyID, stepNum, "上传新配置文件", "running", "", "")

	// 写入临时文件
	tmpPath := "/tmp/nginx_" + startTime.Format("20060102150405") + ".conf"
	file, err := sftpClient.Create(tmpPath)
	if err != nil {
		n.addApplyLog(applyID, stepNum, "上传新配置文件", "failed", "", err.Error())
		finalStatus = "failed"
		errorMsg = "上传配置失败"
		return
	}
	_, err = file.Write([]byte(content))
	file.Close()
	if err != nil {
		n.addApplyLog(applyID, stepNum, "上传新配置文件", "failed", "", err.Error())
		finalStatus = "failed"
		errorMsg = "写入配置失败"
		return
	}

	// 移动到目标位置（需要 sudo 权限）
	mvCmd := "sudo mv " + tmpPath + " " + targetFile
	session, _ := sshClient.NewSession()
	output, err := session.CombinedOutput(mvCmd)
	session.Close()
	if err != nil {
		outputStr := string(output)
		logger.Errorf("移动配置文件失败: %v, 输出: %s", err, outputStr)
		n.addApplyLog(applyID, stepNum, "上传新配置文件", "failed", outputStr, err.Error())
		finalStatus = "failed"
		errorMsg = "移动配置文件失败"
		return
	}

	// 验证配置文件是否真的存在并获取详细信息
	verifyCmd := "ls -lh " + targetFile + " && head -n 5 " + targetFile
	session, _ = sshClient.NewSession()
	verifyOutput, verifyErr := session.CombinedOutput(verifyCmd)
	session.Close()
	verifyOutputStr := string(verifyOutput)
	logger.Infof("配置文件验证: %s", verifyOutputStr)

	if verifyErr != nil {
		logger.Errorf("配置文件验证失败 - 文件不存在: %s", targetFile)
		n.addApplyLog(applyID, stepNum, "上传新配置文件", "failed", "配置文件验证失败: "+verifyOutputStr, "文件未创建")
		finalStatus = "failed"
		errorMsg = "配置文件验证失败"
		return
	}

	n.addApplyLog(applyID, stepNum, "上传新配置文件", "success", "配置文件已上传至: "+targetFile+"\n验证:\n"+verifyOutputStr, "")

	// 步骤5: 测试配置
	stepNum++
	n.addApplyLog(applyID, stepNum, "测试 Nginx 配置", "running", "", "")

	// 查找 nginx 可执行文件路径
	findNginxCmd := "if which nginx >/dev/null 2>&1; then which nginx; elif [ -f /usr/local/nginx/sbin/nginx ]; then echo /usr/local/nginx/sbin/nginx; elif [ -f /usr/sbin/nginx ]; then echo /usr/sbin/nginx; else echo nginx; fi"
	session, _ = sshClient.NewSession()
	nginxPathOutput, _ := session.CombinedOutput(findNginxCmd)
	session.Close()
	nginxPath := strings.TrimSpace(string(nginxPathOutput))
	if nginxPath == "" {
		nginxPath = "nginx" // 回退到 PATH 中查找
	}
	logger.Infof("找到 nginx 路径: %s", nginxPath)

	// 测试配置，指定配置文件路径
	testCmd := "sudo " + nginxPath + " -t -c " + targetFile
	session, _ = sshClient.NewSession()
	output, err = session.CombinedOutput(testCmd)
	session.Close()

	outputStr := string(output)
	if err != nil {
		logger.Errorf("Nginx 配置测试失败: %v, 输出: %s", err, outputStr)
		n.addApplyLog(applyID, stepNum, "测试 Nginx 配置", "failed", outputStr, err.Error())
		finalStatus = "failed"
		errorMsg = "配置测试失败"
		return
	}
	n.addApplyLog(applyID, stepNum, "测试 Nginx 配置", "success", outputStr, "")

	// 步骤6: 重启服务（如果启用）
	if apply.RestartService {
		stepNum++
		n.addApplyLog(applyID, stepNum, "重启 Nginx 服务", "running", "", "")

		// 先尝试 systemctl
		restartCmd := "sudo systemctl restart " + apply.ServiceName
		session, _ = sshClient.NewSession()
		output, err = session.CombinedOutput(restartCmd)
		session.Close()

		outputStr = string(output)
		// 如果 systemctl 失败，检查 nginx 是否运行，然后决定 reload 还是启动
		if err != nil {
			logger.Warnf("systemctl 重启失败，尝试直接操作 nginx: %v", err)

			// 检查 nginx 是否正在运行
			checkCmd := "pgrep -x nginx >/dev/null 2>&1 && echo running || echo stopped"
			session, _ = sshClient.NewSession()
			checkOutput, _ := session.CombinedOutput(checkCmd)
			session.Close()
			nginxStatus := strings.TrimSpace(string(checkOutput))

			var nginxCmd string
			if nginxStatus == "running" {
				// nginx 正在运行，使用 reload
				nginxCmd = "sudo " + nginxPath + " -s reload"
				logger.Infof("Nginx 正在运行，执行 reload")
			} else {
				// nginx 未运行，直接启动
				nginxCmd = "sudo " + nginxPath + " -c " + targetFile
				logger.Infof("Nginx 未运行，执行启动")
			}

			session, _ = sshClient.NewSession()
			output, err = session.CombinedOutput(nginxCmd)
			session.Close()
			outputStr = string(output)

			if err != nil {
				logger.Errorf("Nginx 操作失败: %v, 输出: %s", err, outputStr)
				n.addApplyLog(applyID, stepNum, "重启 Nginx 服务", "failed", outputStr, err.Error())
				finalStatus = "failed"
				errorMsg = "重启服务失败"
				return
			}
		}

		// 验证 nginx 是否真的在运行
		time.Sleep(1 * time.Second) // 等待 nginx 启动
		verifyCmd := "ps aux | grep nginx | grep -v grep || echo 'nginx not running'"
		session, _ = sshClient.NewSession()
		verifyOutput, _ := session.CombinedOutput(verifyCmd)
		session.Close()
		verifyOutputStr := string(verifyOutput)
		logger.Infof("Nginx 进程验证: %s", verifyOutputStr)

		if strings.Contains(verifyOutputStr, "nginx not running") {
			logger.Errorf("Nginx 验证失败 - 进程未运行")
			n.addApplyLog(applyID, stepNum, "重启 Nginx 服务", "failed", "Nginx 进程验证失败:\n"+verifyOutputStr, "进程未运行")
			finalStatus = "failed"
			errorMsg = "Nginx 未成功启动"
			return
		}

		n.addApplyLog(applyID, stepNum, "重启 Nginx 服务", "success", "服务重启成功\n进程验证:\n"+verifyOutputStr, "")
	}

	logger.Infof("Nginx 配置应用成功: apply_id=%d", applyID)
}

// addApplyLog 添加应用日志
func (n *NginxAPI) addApplyLog(applyID uint, step int, action, status, output, errorMsg string) {
	log := &models.NginxConfigApplyLog{
		ApplyID:  applyID,
		Step:     step,
		Action:   action,
		Status:   status,
		Output:   output,
		ErrorMsg: errorMsg,
	}
	db.DB.Create(log)
}

// now 返回当前时间指针
func now() *time.Time {
	t := time.Now()
	return &t
}

// connectToServer 连接到服务器并返回 SSH 和 SFTP 客户端
func connectToServer(server *models.Server) (*ssh.Client, *sftp.Client, error) {
	var authMethods []ssh.AuthMethod

	if server.AuthType == "password" {
		authMethods = append(authMethods, ssh.Password(server.Password))
	} else if server.AuthType == "key" {
		var signer ssh.Signer
		var err error

		if server.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(server.PrivateKey), []byte(server.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(server.PrivateKey))
		}
		if err != nil {
			return nil, nil, fmt.Errorf("解析私钥失败: %v", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	config := &ssh.ClientConfig{
		User:            server.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	sshClient, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, nil, fmt.Errorf("SSH连接失败: %v", err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, nil, fmt.Errorf("SFTP会话创建失败: %v", err)
	}

	return sshClient, sftpClient, nil
}

// GetNginxDeployInfo 获取服务器上的 Nginx 部署信息
func (n *NginxAPI) GetNginxDeployInfo(c *gin.Context) {
	serverID, err := strconv.ParseUint(c.Param("server_id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的服务器 ID")
		return
	}

	// 查询该服务器上最近一次成功部署的 nginx 包
	var deployment models.Deployment
	err = db.DB.
		Joins("JOIN middleware_packages ON middleware_packages.id = deployments.package_id").
		Where("deployments.server_id = ?", serverID).
		Where("deployments.type = ?", "package").
		Where("deployments.status = ?", "success").
		Where("middleware_packages.name = ?", "nginx").
		Order("deployments.completed_at DESC").
		First(&deployment).Error

	if err != nil {
		// 没有找到部署记录，返回默认值
		response.Success(c, gin.H{
			"found":       false,
			"target_path": "",
		})
		return
	}

	response.Success(c, gin.H{
		"found":        true,
		"target_path":  deployment.TargetPath,
		"service_name": deployment.ServiceName,
		"deployed_at":  deployment.CompletedAt,
	})
}
