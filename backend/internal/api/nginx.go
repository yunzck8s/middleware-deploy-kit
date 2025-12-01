package api

import (
	"bytes"
	"strconv"
	"text/template"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
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
	ProxyPass         string `json:"proxy_pass"`
	ClientMaxBodySize string `json:"client_max_body_size"`
	Gzip              bool   `json:"gzip"`
	CustomConfig      string `json:"custom_config"`
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

	if err := db.DB.Create(cfg).Error; err != nil {
		logger.Errorf("创建 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "创建失败")
		return
	}

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
	query := db.DB.Model(&models.NginxConfig{}).Preload("Server").Preload("Certificate")

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
	if err := db.DB.Preload("Server").Preload("Certificate").First(&cfg, id).Error; err != nil {
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

	if err := db.DB.Save(&cfg).Error; err != nil {
		logger.Errorf("更新 Nginx 配置失败: %v", err)
		response.InternalServerError(c, "更新失败")
		return
	}

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
	if err := db.DB.Preload("Certificate").First(&cfg, id).Error; err != nil {
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

user nginx;
worker_processes {{.WorkerProcesses}};
error_log {{.ErrorLogPath}} warn;
pid /var/run/nginx.pid;

events {
    worker_connections {{.WorkerConnections}};
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
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
        location / {
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
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
        location / {
            proxy_pass {{.ProxyPass}};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
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
