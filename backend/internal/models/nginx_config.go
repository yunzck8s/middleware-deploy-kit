package models

import (
	"time"

	"gorm.io/gorm"
)

// NginxConfig Nginx 配置模型
type NginxConfig struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"not null;uniqueIndex"`     // 配置名称
	Description string         `json:"description"`                          // 描述
	ServerID    *uint          `json:"server_id" gorm:"index"`               // 关联的服务器 ID（可选）

	// 基础配置
	WorkerProcesses   string `json:"worker_processes" gorm:"default:'auto'"` // worker 进程数
	WorkerConnections int    `json:"worker_connections" gorm:"default:1024"` // 每个 worker 的连接数

	// HTTP 配置
	EnableHTTP  bool `json:"enable_http" gorm:"default:true"`   // 是否启用 HTTP
	HTTPPort    int  `json:"http_port" gorm:"default:80"`       // HTTP 端口

	// HTTPS 配置
	EnableHTTPS   bool  `json:"enable_https" gorm:"default:false"` // 是否启用 HTTPS
	HTTPSPort     int   `json:"https_port" gorm:"default:443"`     // HTTPS 端口
	CertificateID *uint `json:"certificate_id" gorm:"index"`       // 关联的证书 ID
	HTTPToHTTPS   bool  `json:"http_to_https" gorm:"default:false"` // HTTP 跳转 HTTPS

	// Server 配置
	ServerName   string `json:"server_name" gorm:"default:'_'"`              // 域名
	RootPath     string `json:"root_path" gorm:"default:'/usr/local/nginx/html'"` // 根目录
	IndexFiles   string `json:"index_files" gorm:"default:'index.html index.htm'"` // 索引文件

	// 日志配置
	AccessLogPath string `json:"access_log_path" gorm:"default:'/usr/local/nginx/logs/access.log'"` // 访问日志
	ErrorLogPath  string `json:"error_log_path" gorm:"default:'/usr/local/nginx/logs/error.log'"`   // 错误日志
	LogFormat     string `json:"log_format" gorm:"default:'main'"`                            // 日志格式：main 或 json

	// 日志轮转配置
	RotateEnabled   bool   `json:"rotate_enabled" gorm:"default:false"`
	RotateFrequency string `json:"rotate_frequency" gorm:"default:'daily'"`
	RotateCount     int    `json:"rotate_count" gorm:"default:14"`
	RotateMaxSize   string `json:"rotate_max_size" gorm:"default:'100M'"`
	RotateCompress  bool   `json:"rotate_compress" gorm:"default:true"`
	RotateDateExt   bool   `json:"rotate_date_ext" gorm:"default:true"`

	// 代理配置（反向代理）
	EnableProxy    bool   `json:"enable_proxy" gorm:"default:false"`    // 是否启用反向代理
	ProxyPass      string `json:"proxy_pass"`                            // 代理地址
	ProxySetHeader string `json:"proxy_set_header" gorm:"type:text"`    // 代理头设置（JSON）

	// 其他设置
	ClientMaxBodySize string `json:"client_max_body_size" gorm:"default:'100m'"` // 客户端最大请求体
	Gzip              bool   `json:"gzip" gorm:"default:true"`                   // 是否启用 Gzip
	CustomConfig      string `json:"custom_config" gorm:"type:text"`             // 自定义配置片段
	ManualConfig      string `json:"manual_config" gorm:"type:text"`             // 手动编辑的完整配置（优先级高于自动生成）

	// SSL/TLS 高级配置
	SSLProtocols string `json:"ssl_protocols" gorm:"default:'TLSv1.2 TLSv1.3'"`
	SSLCiphers   string `json:"ssl_ciphers"`
	EnableHSTS   bool   `json:"enable_hsts" gorm:"default:false"`
	HSTSMaxAge   int    `json:"hsts_max_age" gorm:"default:31536000"`
	EnableOCSP   bool   `json:"enable_ocsp" gorm:"default:false"`

	// 缓存配置
	CacheEnabled   bool   `json:"cache_enabled" gorm:"default:false"`
	CachePath      string `json:"cache_path" gorm:"default:'/var/cache/nginx'"`
	CacheSize      string `json:"cache_size" gorm:"default:'10m'"`
	CacheValidTime string `json:"cache_valid_time" gorm:"default:'60m'"`

	// 安全配置
	RateLimitEnabled bool   `json:"rate_limit_enabled" gorm:"default:false"`
	RateLimitZone    string `json:"rate_limit_zone"`
	RateLimitBurst   int    `json:"rate_limit_burst" gorm:"default:20"`
	ConnLimitEnabled bool   `json:"conn_limit_enabled" gorm:"default:false"`
	ConnLimitZone    string `json:"conn_limit_zone"`
	ConnLimitNum     int    `json:"conn_limit_num" gorm:"default:100"`
	AllowIPs         string `json:"allow_ips" gorm:"type:text"`
	DenyIPs          string `json:"deny_ips" gorm:"type:text"`
	SecurityHeaders  string `json:"security_headers" gorm:"type:text"`

	// 状态
	Status    string    `json:"status" gorm:"default:'draft'"` // draft, active, disabled
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	Server      *Server         `json:"server,omitempty" gorm:"foreignKey:ServerID"`
	Certificate *Certificate    `json:"certificate,omitempty" gorm:"foreignKey:CertificateID"`
	Locations   []NginxLocation `json:"locations,omitempty" gorm:"foreignKey:NginxConfigID"`
	Upstreams   []NginxUpstream `json:"upstreams,omitempty" gorm:"foreignKey:NginxConfigID"`
}

// TableName 表名
func (NginxConfig) TableName() string {
	return "nginx_configs"
}

// NginxLocation Nginx Location 配置
type NginxLocation struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	NginxConfigID uint   `json:"nginx_config_id" gorm:"not null;index"`
	Path          string `json:"path" gorm:"not null"`                // 路径，如 /、/api、/static
	MatchType     string `json:"match_type" gorm:"default:'prefix'"` // 匹配类型：exact(=), prefix(无), regex(~)

	// 处理方式
	HandlerType string `json:"handler_type" gorm:"default:'static'"` // static, proxy, redirect, return

	// Static 配置
	Root      string `json:"root"`       // 根目录
	TryFiles  string `json:"try_files"`  // try_files 配置

	// Proxy 配置
	ProxyPass       string `json:"proxy_pass"`        // 代理地址
	ProxySetHeaders string `json:"proxy_set_headers"` // JSON 格式的额外自定义 header

	// Proxy 高级配置
	ProxyConnectTimeout       string `json:"proxy_connect_timeout"`        // 连接超时
	ProxySendTimeout          string `json:"proxy_send_timeout"`           // 发送超时
	ProxyReadTimeout          string `json:"proxy_read_timeout"`           // 读取超时
	ProxyBuffering            string `json:"proxy_buffering"`              // 代理缓冲 on/off
	ProxyBufferSize           string `json:"proxy_buffer_size"`            // 缓冲区大小
	ProxyBuffers              string `json:"proxy_buffers"`                // 缓冲区数量和大小
	ProxyBusyBuffersSize      string `json:"proxy_busy_buffers_size"`      // 忙碌缓冲区大小
	ProxyTempFileWriteSize    string `json:"proxy_temp_file_write_size"`   // 临时文件写入大小
	ProxyNextUpstream         string `json:"proxy_next_upstream"`          // 失败转移条件
	ProxyNextUpstreamTries    int    `json:"proxy_next_upstream_tries"`    // 最大重试次数
	ProxyNextUpstreamTimeout  string `json:"proxy_next_upstream_timeout"`  // 重试超时
	ProxyHTTPVersion          string `json:"proxy_http_version"`           // HTTP 版本
	ProxyMaxTempFileSize      string `json:"proxy_max_temp_file_size"`     // 代理最大临时文件大小
	EnableWebsocket           bool   `json:"enable_websocket"`             // 是否启用 WebSocket
	EnableCORS                bool   `json:"enable_cors"`                  // 是否启用 CORS
	LocationMaxBodySize       string `json:"location_max_body_size"`       // Location 级别最大请求体

	// Redirect 配置
	RedirectURL  string `json:"redirect_url"`
	RedirectCode int    `json:"redirect_code" gorm:"default:301"` // 301 或 302

	// Return 配置
	ReturnCode int    `json:"return_code"`
	ReturnBody string `json:"return_body"`

	// 排序
	SortOrder int       `json:"sort_order" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName 表名
func (NginxLocation) TableName() string {
	return "nginx_locations"
}

// NginxUpstream Nginx Upstream 配置
type NginxUpstream struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	NginxConfigID uint   `json:"nginx_config_id" gorm:"not null;index"`
	Name          string `json:"name" gorm:"not null"`                   // upstream 名称
	LoadBalance   string `json:"load_balance" gorm:"default:'round_robin'"` // 负载均衡：round_robin, least_conn, ip_hash
	Servers       string `json:"servers" gorm:"type:text"`               // JSON 格式的服务器列表
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName 表名
func (NginxUpstream) TableName() string {
	return "nginx_upstreams"
}
