package api

import (
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
	"golang.org/x/crypto/ssh"
)

// ServerAPI 服务器管理 API
type ServerAPI struct {
	cfg *config.Config
}

// NewServerAPI 创建服务器 API 实例
func NewServerAPI(cfg *config.Config) *ServerAPI {
	return &ServerAPI{cfg: cfg}
}

// CreateServerRequest 创建服务器请求
type CreateServerRequest struct {
	Name        string `json:"name" binding:"required"`
	Host        string `json:"host" binding:"required"`
	Port        int    `json:"port"`
	Username    string `json:"username" binding:"required"`
	AuthType    string `json:"auth_type"` // password 或 key
	Password    string `json:"password"`
	PrivateKey  string `json:"private_key"`
	Passphrase  string `json:"passphrase"`
	OSType      string `json:"os_type"`
	OSVersion   string `json:"os_version"`
	Description string `json:"description"`
	Tags        string `json:"tags"`
}

// UpdateServerRequest 更新服务器请求
type UpdateServerRequest struct {
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	AuthType    string `json:"auth_type"`
	Password    string `json:"password"`
	PrivateKey  string `json:"private_key"`
	Passphrase  string `json:"passphrase"`
	OSType      string `json:"os_type"`
	OSVersion   string `json:"os_version"`
	Description string `json:"description"`
	Tags        string `json:"tags"`
}

// Create 创建服务器
func (s *ServerAPI) Create(c *gin.Context) {
	var req CreateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 设置默认值
	if req.Port == 0 {
		req.Port = 22
	}
	if req.AuthType == "" {
		req.AuthType = "password"
	}

	// 验证认证信息
	if req.AuthType == "password" && req.Password == "" {
		response.BadRequest(c, "密码认证方式需要提供密码")
		return
	}
	if req.AuthType == "key" && req.PrivateKey == "" {
		response.BadRequest(c, "密钥认证方式需要提供私钥")
		return
	}

	// 检查服务器是否已存在
	var existingServer models.Server
	result := db.DB.Where("host = ? AND port = ?", req.Host, req.Port).First(&existingServer)
	if result.Error == nil {
		response.ConflictWithData(c, "该服务器已存在", gin.H{
			"existing_server": existingServer,
		})
		return
	}

	// 创建服务器
	server := &models.Server{
		Name:        req.Name,
		Host:        req.Host,
		Port:        req.Port,
		Username:    req.Username,
		AuthType:    req.AuthType,
		Password:    req.Password,
		PrivateKey:  req.PrivateKey,
		Passphrase:  req.Passphrase,
		OSType:      req.OSType,
		OSVersion:   req.OSVersion,
		Description: req.Description,
		Tags:        req.Tags,
		Status:      "unknown",
	}

	if err := db.DB.Create(server).Error; err != nil {
		logger.Errorf("创建服务器失败: %v", err)
		response.InternalServerError(c, "创建服务器失败")
		return
	}

	logger.Infof("服务器创建成功: %s (%s:%d)", server.Name, server.Host, server.Port)
	response.SuccessWithMessage(c, "创建成功", server)
}

// List 获取服务器列表
func (s *ServerAPI) List(c *gin.Context) {
	status := c.Query("status")
	osType := c.Query("os_type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var servers []models.Server
	query := db.DB.Model(&models.Server{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if osType != "" {
		query = query.Where("os_type = ?", osType)
	}

	// 获取总数
	var total int64
	query.Count(&total)

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&servers).Error; err != nil {
		logger.Errorf("查询服务器列表失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"servers":   servers,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// Get 获取服务器详情
func (s *ServerAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var server models.Server
	if err := db.DB.First(&server, id).Error; err != nil {
		response.NotFound(c, "服务器不存在")
		return
	}

	response.Success(c, server)
}

// Update 更新服务器
func (s *ServerAPI) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var server models.Server
	if err := db.DB.First(&server, id).Error; err != nil {
		response.NotFound(c, "服务器不存在")
		return
	}

	var req UpdateServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 更新字段
	if req.Name != "" {
		server.Name = req.Name
	}
	if req.Host != "" {
		server.Host = req.Host
	}
	if req.Port != 0 {
		server.Port = req.Port
	}
	if req.Username != "" {
		server.Username = req.Username
	}
	if req.AuthType != "" {
		server.AuthType = req.AuthType
	}
	if req.Password != "" {
		server.Password = req.Password
	}
	if req.PrivateKey != "" {
		server.PrivateKey = req.PrivateKey
	}
	if req.Passphrase != "" {
		server.Passphrase = req.Passphrase
	}
	if req.OSType != "" {
		server.OSType = req.OSType
	}
	if req.OSVersion != "" {
		server.OSVersion = req.OSVersion
	}
	if req.Description != "" {
		server.Description = req.Description
	}
	if req.Tags != "" {
		server.Tags = req.Tags
	}

	if err := db.DB.Save(&server).Error; err != nil {
		logger.Errorf("更新服务器失败: %v", err)
		response.InternalServerError(c, "更新失败")
		return
	}

	logger.Infof("服务器更新成功: %s (ID: %d)", server.Name, server.ID)
	response.SuccessWithMessage(c, "更新成功", server)
}

// Delete 删除服务器
func (s *ServerAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var server models.Server
	if err := db.DB.First(&server, id).Error; err != nil {
		response.NotFound(c, "服务器不存在")
		return
	}

	// 软删除
	if err := db.DB.Delete(&server).Error; err != nil {
		logger.Errorf("删除服务器失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

	logger.Infof("服务器已删除: %s (ID: %d)", server.Name, server.ID)
	response.SuccessWithMessage(c, "删除成功", nil)
}

// TestConnection 测试 SSH 连接
func (s *ServerAPI) TestConnection(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var server models.Server
	if err := db.DB.First(&server, id).Error; err != nil {
		response.NotFound(c, "服务器不存在")
		return
	}

	// 执行连接测试
	result := testSSHConnection(&server)

	// 更新服务器状态
	now := time.Now()
	server.LastCheckAt = &now
	server.LastCheckMsg = result.Message

	if result.Success {
		server.Status = "online"
		// 如果获取到了操作系统信息，更新它
		if result.OSInfo != "" {
			server.OSType = result.OSType
			server.OSVersion = result.OSVersion
		}
	} else {
		server.Status = "offline"
	}

	db.DB.Save(&server)

	response.Success(c, gin.H{
		"success":    result.Success,
		"message":    result.Message,
		"latency_ms": result.LatencyMs,
		"os_info":    result.OSInfo,
		"server":     server,
	})
}

// TestConnectionRequest 测试连接请求（不保存到数据库）
type TestConnectionRequest struct {
	Host       string `json:"host" binding:"required"`
	Port       int    `json:"port"`
	Username   string `json:"username" binding:"required"`
	AuthType   string `json:"auth_type"`
	Password   string `json:"password"`
	PrivateKey string `json:"private_key"`
	Passphrase string `json:"passphrase"`
}

// TestConnectionDirect 直接测试连接（不需要保存的服务器）
func (s *ServerAPI) TestConnectionDirect(c *gin.Context) {
	var req TestConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if req.Port == 0 {
		req.Port = 22
	}
	if req.AuthType == "" {
		req.AuthType = "password"
	}

	server := &models.Server{
		Host:       req.Host,
		Port:       req.Port,
		Username:   req.Username,
		AuthType:   req.AuthType,
		Password:   req.Password,
		PrivateKey: req.PrivateKey,
		Passphrase: req.Passphrase,
	}

	result := testSSHConnection(server)

	response.Success(c, gin.H{
		"success":    result.Success,
		"message":    result.Message,
		"latency_ms": result.LatencyMs,
		"os_info":    result.OSInfo,
		"os_type":    result.OSType,
		"os_version": result.OSVersion,
	})
}

// SSHTestResult SSH 测试结果
type SSHTestResult struct {
	Success   bool
	Message   string
	LatencyMs int64
	OSInfo    string
	OSType    string
	OSVersion string
}

// testSSHConnection 测试 SSH 连接
func testSSHConnection(server *models.Server) *SSHTestResult {
	result := &SSHTestResult{}
	startTime := time.Now()

	// 配置 SSH 客户端
	var authMethods []ssh.AuthMethod

	if server.AuthType == "key" && server.PrivateKey != "" {
		var signer ssh.Signer
		var err error

		if server.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(server.PrivateKey), []byte(server.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(server.PrivateKey))
		}

		if err != nil {
			result.Message = fmt.Sprintf("解析私钥失败: %v", err)
			return result
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	} else if server.Password != "" {
		authMethods = append(authMethods, ssh.Password(server.Password))
	} else {
		result.Message = "未提供有效的认证信息"
		return result
	}

	config := &ssh.ClientConfig{
		User:            server.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // 生产环境应使用更安全的方式
		Timeout:         10 * time.Second,
	}

	// 建立连接
	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			result.Message = "连接超时"
		} else {
			result.Message = fmt.Sprintf("连接失败: %v", err)
		}
		return result
	}
	defer client.Close()

	result.LatencyMs = time.Since(startTime).Milliseconds()

	// 获取操作系统信息
	session, err := client.NewSession()
	if err != nil {
		result.Success = true
		result.Message = "连接成功，但无法创建会话"
		return result
	}
	defer session.Close()

	// 执行命令获取 OS 信息
	output, err := session.CombinedOutput("cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || uname -a")
	if err == nil {
		result.OSInfo = string(output)
		// 解析 OS 信息
		result.OSType, result.OSVersion = parseOSInfo(string(output))
	}

	result.Success = true
	result.Message = "连接成功"
	return result
}

// parseOSInfo 解析操作系统信息
func parseOSInfo(osInfo string) (osType, osVersion string) {
	// 简单解析，可以根据需要扩展
	switch {
	case contains(osInfo, "Rocky"):
		osType = "rocky"
	case contains(osInfo, "CentOS"):
		osType = "centos"
	case contains(osInfo, "openEuler"):
		osType = "openEuler"
	case contains(osInfo, "Kylin"):
		osType = "kylin"
	case contains(osInfo, "Ubuntu"):
		osType = "ubuntu"
	case contains(osInfo, "Debian"):
		osType = "debian"
	default:
		osType = "unknown"
	}

	// 提取版本号（简单实现）
	// 可以使用正则表达式进行更精确的提取
	return osType, osVersion
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsImpl(s, substr))
}

func containsImpl(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
