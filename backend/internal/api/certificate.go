package api

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// CertificateAPI 证书管理 API
type CertificateAPI struct {
	cfg *config.Config
}

// NewCertificateAPI 创建证书 API 实例
func NewCertificateAPI(cfg *config.Config) *CertificateAPI {
	return &CertificateAPI{cfg: cfg}
}

// UploadCertRequest 上传证书请求
type UploadCertRequest struct {
	Name       string `form:"name" binding:"required"`   // 证书名称
	Domain     string `form:"domain"`                    // 域名
	InstanceID *uint  `form:"instance_id"`               // 关联实例ID
}

// Upload 上传证书
func (ca *CertificateAPI) Upload(c *gin.Context) {
	var req UploadCertRequest
	if err := c.ShouldBind(&req); err != nil {
		response.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 获取证书文件和密钥文件
	certFile, err := c.FormFile("cert_file")
	if err != nil {
		response.BadRequest(c, "未找到证书文件 (cert_file)")
		return
	}

	keyFile, err := c.FormFile("key_file")
	if err != nil {
		response.BadRequest(c, "未找到密钥文件 (key_file)")
		return
	}

	// 验证文件扩展名
	certExt := strings.ToLower(filepath.Ext(certFile.Filename))
	keyExt := strings.ToLower(filepath.Ext(keyFile.Filename))

	if certExt != ".crt" && certExt != ".pem" {
		response.BadRequest(c, "证书文件格式不正确（需要 .crt 或 .pem）")
		return
	}

	if keyExt != ".key" && keyExt != ".pem" {
		response.BadRequest(c, "密钥文件格式不正确（需要 .key 或 .pem）")
		return
	}

	// 创建存储目录
	certDir := filepath.Join(ca.cfg.Data.UploadDir, "certificates", req.Name)
	if err := os.MkdirAll(certDir, 0755); err != nil {
		logger.Errorf("创建证书目录失败: %v", err)
		response.InternalServerError(c, "创建证书目录失败")
		return
	}

	// 保存证书文件
	certPath := filepath.Join(certDir, "cert.crt")
	if err := c.SaveUploadedFile(certFile, certPath); err != nil {
		logger.Errorf("保存证书文件失败: %v", err)
		response.InternalServerError(c, "保存证书文件失败")
		return
	}

	// 保存密钥文件
	keyPath := filepath.Join(certDir, "cert.key")
	if err := c.SaveUploadedFile(keyFile, keyPath); err != nil {
		logger.Errorf("保存密钥文件失败: %v", err)
		os.Remove(certPath) // 清理已保存的证书文件
		response.InternalServerError(c, "保存密钥文件失败")
		return
	}

	// 解析证书以获取详细信息
	certData, err := os.ReadFile(certPath)
	if err != nil {
		logger.Errorf("读取证书文件失败: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.InternalServerError(c, "读取证书文件失败")
		return
	}

	block, _ := pem.Decode(certData)
	if block == nil {
		logger.Error("无法解码证书文件")
		cleanupCertFiles(certPath, keyPath)
		response.BadRequest(c, "无效的证书文件格式")
		return
	}

	// Fix 2: PEM Block 类型校验
	if block.Type != "CERTIFICATE" {
		logger.Errorf("证书文件 PEM 类型无效: %s", block.Type)
		cleanupCertFiles(certPath, keyPath)
		response.BadRequest(c, fmt.Sprintf("证书文件 PEM 类型无效，期望 CERTIFICATE，实际为 %s", block.Type))
		return
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		logger.Errorf("解析证书失败: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.BadRequest(c, "无效的证书文件: "+err.Error())
		return
	}

	// Fix 1: 证书-私钥匹配验证
	keyData, err := os.ReadFile(keyPath)
	if err != nil {
		logger.Errorf("读取密钥文件失败: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.InternalServerError(c, "读取密钥文件失败")
		return
	}

	_, err = tls.X509KeyPair(certData, keyData)
	if err != nil {
		logger.Errorf("证书和密钥不匹配: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.BadRequest(c, "证书和密钥不匹配")
		return
	}

	// Fix 3: 重名检测修复 uniqueIndex 冲突
	var existingCert models.Certificate
	result := db.DB.Where("name = ? AND status != 'deleted'", req.Name).First(&existingCert)
	if result.Error == nil {
		cleanupCertFiles(certPath, keyPath)
		response.ConflictWithData(c, "证书名称已存在", gin.H{
			"existing_certificate": existingCert,
		})
		return
	}

	// 提取域名（如果未提供）
	domain := req.Domain
	if domain == "" && len(cert.DNSNames) > 0 {
		domain = cert.DNSNames[0]
	} else if domain == "" {
		domain = cert.Subject.CommonName
	}

	// 确定证书状态
	status := "active"
	if time.Now().After(cert.NotAfter) {
		status = "expired"
	}

	// 创建数据库记录
	certificate := &models.Certificate{
		Name:         req.Name,
		Domain:       domain,
		InstanceID:   req.InstanceID,
		CertFilePath: certPath,
		KeyFilePath:  keyPath,
		ValidFrom:    cert.NotBefore,
		ValidUntil:   cert.NotAfter,
		Issuer:       cert.Issuer.CommonName,
		Subject:      cert.Subject.CommonName,
		Status:       status,
	}

	if err := db.DB.Create(certificate).Error; err != nil {
		logger.Errorf("创建证书记录失败: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.InternalServerError(c, "创建证书记录失败")
		return
	}

	logger.Infof("证书上传成功: %s (域名: %s)", certificate.Name, certificate.Domain)
	response.SuccessWithMessage(c, "上传成功", certificate)
}

// List 获取证书列表
func (ca *CertificateAPI) List(c *gin.Context) {
	status := c.Query("status")   // 筛选状态：active, expired
	instanceID := c.Query("instance_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	// Fix 5: 后端分页上限从 100 改为 1000
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 20
	}

	var certificates []models.Certificate
	query := db.DB.Where("status != ?", "deleted")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if instanceID != "" {
		query = query.Where("instance_id = ?", instanceID)
	}

	// Fix 7: 批量更新已过期但状态仍为 active 的证书
	db.DB.Model(&models.Certificate{}).
		Where("status = ? AND valid_until < ?", "active", time.Now()).
		Update("status", "expired")

	// 获取总数
	var total int64
	query.Model(&models.Certificate{}).Count(&total)

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&certificates).Error; err != nil {
		logger.Errorf("查询证书列表失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"certificates": certificates,
		"total":        total,
		"page":         page,
		"page_size":    pageSize,
	})
}

// Get 获取证书详情
func (ca *CertificateAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cert models.Certificate
	if err := db.DB.First(&cert, id).Error; err != nil {
		response.NotFound(c, "证书不存在")
		return
	}

	response.Success(c, cert)
}

// Delete 删除证书
func (ca *CertificateAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cert models.Certificate
	if err := db.DB.First(&cert, id).Error; err != nil {
		response.NotFound(c, "证书不存在")
		return
	}

	// Fix 4: 删除前检查 NginxConfig 引用
	var configCount int64
	db.DB.Model(&models.NginxConfig{}).Where("certificate_id = ?", id).Count(&configCount)
	if configCount > 0 {
		response.BadRequest(c, fmt.Sprintf("该证书正在被 %d 个 Nginx 配置使用，无法删除", configCount))
		return
	}

	// 软删除：更新状态为 deleted
	cert.Status = "deleted"
	if err := db.DB.Save(&cert).Error; err != nil {
		logger.Errorf("删除证书失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

	// Fix 6: 软删除清理文件
	cleanupCertFiles(cert.CertFilePath, cert.KeyFilePath)

	logger.Infof("证书已删除: %s (ID: %d)", cert.Name, cert.ID)
	response.SuccessWithMessage(c, "删除成功", nil)
}

// Download 下载证书文件
func (ca *CertificateAPI) Download(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	fileType := c.Query("type") // cert 或 key
	if fileType != "cert" && fileType != "key" {
		response.BadRequest(c, "无效的文件类型（必须是 cert 或 key）")
		return
	}

	var cert models.Certificate
	if err := db.DB.First(&cert, id).Error; err != nil {
		response.NotFound(c, "证书不存在")
		return
	}

	var filePath string
	var fileName string

	if fileType == "cert" {
		filePath = cert.CertFilePath
		fileName = fmt.Sprintf("%s.crt", cert.Name)
	} else {
		filePath = cert.KeyFilePath
		fileName = fmt.Sprintf("%s.key", cert.Name)
	}

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		response.NotFound(c, "文件不存在")
		return
	}

	// Fix 8: 下载私钥增加二次确认日志
	if fileType == "key" {
		logger.Warnf("私钥文件被下载: 证书=%s (ID: %d), 操作者=%v", cert.Name, cert.ID, c.GetString("username"))
	}

	// 下载文件
	c.FileAttachment(filePath, fileName)
}

// cleanupCertFiles 清理证书文件
func cleanupCertFiles(certPath, keyPath string) {
	os.Remove(certPath)
	os.Remove(keyPath)
	// 尝试删除目录（如果为空）
	dir := filepath.Dir(certPath)
	os.Remove(dir)
}

// parseCertificate 解析证书文件
func parseCertificate(certPath string) (*x509.Certificate, error) {
	// 读取证书文件
	file, err := os.Open(certPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	// 解码 PEM
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// 解析证书
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}

	return cert, nil
}

// Update 更新证书（使用原子替换策略）
func (ca *CertificateAPI) Update(c *gin.Context) {
	// 1. 获取证书 ID
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的证书ID")
		return
	}

	// 2. 查询证书
	var cert models.Certificate
	if err := db.DB.First(&cert, id).Error; err != nil {
		response.NotFound(c, "证书不存在")
		return
	}

	// 3. 获取新的证书和私钥文件
	certFile, err := c.FormFile("cert_file")
	if err != nil {
		response.BadRequest(c, "未找到证书文件 (cert_file)")
		return
	}

	keyFile, err := c.FormFile("key_file")
	if err != nil {
		response.BadRequest(c, "未找到密钥文件 (key_file)")
		return
	}

	// 4. 获取自动部署参数
	autoDeployStr := c.PostForm("auto_deploy")
	autoDeploy := autoDeployStr == "true"

	// 5. 验证文件扩展名
	certExt := strings.ToLower(filepath.Ext(certFile.Filename))
	keyExt := strings.ToLower(filepath.Ext(keyFile.Filename))

	if certExt != ".crt" && certExt != ".pem" {
		response.BadRequest(c, "证书文件格式不正确（需要 .crt 或 .pem）")
		return
	}

	if keyExt != ".key" && keyExt != ".pem" {
		response.BadRequest(c, "密钥文件格式不正确（需要 .key 或 .pem）")
		return
	}

	// 6. 创建临时文件路径
	tmpCertPath := cert.CertFilePath + ".tmp"
	tmpKeyPath := cert.KeyFilePath + ".tmp"
	backupCertPath := cert.CertFilePath + ".old"
	backupKeyPath := cert.KeyFilePath + ".old"

	// 7. 保存新文件到临时路径
	if err := c.SaveUploadedFile(certFile, tmpCertPath); err != nil {
		logger.Errorf("保存临时证书文件失败: %v", err)
		response.InternalServerError(c, "保存证书文件失败")
		return
	}

	if err := c.SaveUploadedFile(keyFile, tmpKeyPath); err != nil {
		os.Remove(tmpCertPath)
		logger.Errorf("保存临时密钥文件失败: %v", err)
		response.InternalServerError(c, "保存密钥文件失败")
		return
	}

	// 8. 验证证书和私钥匹配
	certData, err := os.ReadFile(tmpCertPath)
	if err != nil {
		os.Remove(tmpCertPath)
		os.Remove(tmpKeyPath)
		response.InternalServerError(c, "读取临时证书文件失败")
		return
	}

	keyData, err := os.ReadFile(tmpKeyPath)
	if err != nil {
		os.Remove(tmpCertPath)
		os.Remove(tmpKeyPath)
		response.InternalServerError(c, "读取临时密钥文件失败")
		return
	}

	_, err = tls.X509KeyPair(certData, keyData)
	if err != nil {
		os.Remove(tmpCertPath)
		os.Remove(tmpKeyPath)
		response.BadRequest(c, "证书和私钥不匹配: "+err.Error())
		return
	}

	// 9. 备份旧文件
	os.Rename(cert.CertFilePath, backupCertPath)
	os.Rename(cert.KeyFilePath, backupKeyPath)

	// 10. 原子替换：重命名临时文件为正式文件
	if err := os.Rename(tmpCertPath, cert.CertFilePath); err != nil {
		// 恢复备份
		os.Rename(backupCertPath, cert.CertFilePath)
		os.Rename(backupKeyPath, cert.KeyFilePath)
		logger.Errorf("替换证书文件失败: %v", err)
		response.InternalServerError(c, "替换证书文件失败")
		return
	}

	if err := os.Rename(tmpKeyPath, cert.KeyFilePath); err != nil {
		// 恢复备份
		os.Rename(cert.CertFilePath, tmpCertPath)
		os.Rename(backupCertPath, cert.CertFilePath)
		os.Rename(backupKeyPath, cert.KeyFilePath)
		logger.Errorf("替换密钥文件失败: %v", err)
		response.InternalServerError(c, "替换密钥文件失败")
		return
	}

	// 11. 重新解析证书信息
	x509Cert, err := parseCertificate(cert.CertFilePath)
	if err != nil {
		logger.Errorf("解析新证书失败: %v", err)
		response.InternalServerError(c, "解析证书失败")
		return
	}

	// 12. 更新数据库
	cert.ValidFrom = x509Cert.NotBefore
	cert.ValidUntil = x509Cert.NotAfter
	cert.Issuer = x509Cert.Issuer.String()
	cert.Subject = x509Cert.Subject.String()
	cert.Status = "active"

	// Fix P2: 重新提取域名
	if len(x509Cert.DNSNames) > 0 {
		cert.Domain = x509Cert.DNSNames[0]
	} else {
		cert.Domain = x509Cert.Subject.CommonName
	}

	if err := db.DB.Save(&cert).Error; err != nil {
		logger.Errorf("更新证书数据库记录失败: %v", err)
		response.InternalServerError(c, "更新证书信息失败")
		return
	}

	// 13. 自动部署到相关服务器
	deployResults := make(map[string]string)
	if autoDeploy {
		// 查找所有使用该证书的 NginxConfig
		var configs []models.NginxConfig
		if err := db.DB.Where("certificate_id = ?", cert.ID).Find(&configs).Error; err != nil {
			logger.Errorf("查询使用该证书的配置失败: %v", err)
		} else {
			// 提取唯一的 server_id
			serverIDs := make(map[uint]bool)
			for _, config := range configs {
				if config.ServerID != nil {
					serverIDs[*config.ServerID] = true
				}
			}

			// 部署到每个服务器
			for serverID := range serverIDs {
				var server models.Server
				if err := db.DB.First(&server, serverID).Error; err != nil {
					deployResults[fmt.Sprintf("server_%d", serverID)] = "查询服务器失败: " + err.Error()
					continue
				}

				if err := deployCertificateToServer(&cert, &server); err != nil {
					deployResults[server.Name] = "部署失败: " + err.Error()
					logger.Errorf("部署证书到服务器 %s 失败: %v", server.Name, err)
				} else {
					deployResults[server.Name] = "部署成功"
					logger.Infof("证书已成功部署到服务器: %s", server.Name)
				}
			}
		}
	}

	// 14. 删除备份文件（可选）
	os.Remove(backupCertPath)
	os.Remove(backupKeyPath)

	response.Success(c, gin.H{
		"certificate":    cert,
		"deploy_results": deployResults,
	})
}

// deployCertificateToServer 部署证书到远程服务器（使用原子替换策略）
func deployCertificateToServer(cert *models.Certificate, server *models.Server) error {
	// 1. 建立 SSH/SFTP 连接
	sshClient, sftpClient, err := connectToServer(server)
	if err != nil {
		return fmt.Errorf("连接服务器失败: %v", err)
	}
	defer sshClient.Close()
	defer sftpClient.Close()

	// 2. 获取 nginx 安装目录
	installDir := inferNginxInstallDir(server.ID)
	nginxBin := ""

	// Fix P1: 当无法推导安装目录时，尝试检测实际路径
	if installDir == "" {
		// 尝试使用 which nginx 查找
		output, err := runSSHCommand(sshClient, "which nginx")
		if err == nil && strings.TrimSpace(output) != "" {
			nginxBin = strings.TrimSpace(output)
			// 从 /usr/sbin/nginx 推导出基础目录（通常配置在 /etc/nginx）
			if strings.Contains(nginxBin, "/usr/sbin") || strings.Contains(nginxBin, "/usr/bin") {
				installDir = "/etc/nginx"
			} else {
				// 从 /usr/local/nginx/sbin/nginx 推导
				installDir = filepath.Dir(filepath.Dir(nginxBin))
			}
		} else {
			// 回退到默认路径
			installDir = "/usr/local/nginx"
			nginxBin = filepath.Join(installDir, "sbin", "nginx")
		}
	} else {
		nginxBin = filepath.Join(installDir, "sbin", "nginx")
	}

	// 3. 创建 ssl 目录
	sslDir := filepath.Join(installDir, "ssl")
	mkdirCmd := fmt.Sprintf("sudo mkdir -p %s", shellQuote(sslDir))
	if _, err := runSSHCommand(sshClient, mkdirCmd); err != nil {
		return fmt.Errorf("创建 ssl 目录失败: %v", err)
	}

	// 4. 读取本地证书文件
	certData, err := os.ReadFile(cert.CertFilePath)
	if err != nil {
		return fmt.Errorf("读取证书文件失败: %v", err)
	}

	keyData, err := os.ReadFile(cert.KeyFilePath)
	if err != nil {
		return fmt.Errorf("读取密钥文件失败: %v", err)
	}

	// 5. 上传到临时文件
	remoteCertPath := filepath.Join(sslDir, "cert.crt")
	remoteKeyPath := filepath.Join(sslDir, "cert.key")
	tmpRemoteCertPath := remoteCertPath + ".tmp"
	tmpRemoteKeyPath := remoteKeyPath + ".tmp"

	// 上传证书临时文件
	tmpCertFile, err := sftpClient.Create(tmpRemoteCertPath)
	if err != nil {
		return fmt.Errorf("创建临时证书文件失败: %v", err)
	}
	if _, err := tmpCertFile.Write(certData); err != nil {
		tmpCertFile.Close()
		return fmt.Errorf("写入临时证书文件失败: %v", err)
	}
	tmpCertFile.Close()

	// 上传密钥临时文件
	tmpKeyFile, err := sftpClient.Create(tmpRemoteKeyPath)
	if err != nil {
		return fmt.Errorf("创建临时密钥文件失败: %v", err)
	}
	if _, err := tmpKeyFile.Write(keyData); err != nil {
		tmpKeyFile.Close()
		return fmt.Errorf("写入临时密钥文件失败: %v", err)
	}
	tmpKeyFile.Close()

	// 6. 原子替换：mv 临时文件到正式文件（Fix P1: 添加 sudo）
	mvCertCmd := fmt.Sprintf("sudo mv %s %s", shellQuote(tmpRemoteCertPath), shellQuote(remoteCertPath))
	if _, err := runSSHCommand(sshClient, mvCertCmd); err != nil {
		return fmt.Errorf("替换证书文件失败: %v", err)
	}

	mvKeyCmd := fmt.Sprintf("sudo mv %s %s", shellQuote(tmpRemoteKeyPath), shellQuote(remoteKeyPath))
	if _, err := runSSHCommand(sshClient, mvKeyCmd); err != nil {
		return fmt.Errorf("替换密钥文件失败: %v", err)
	}

	// 7. 设置权限（Fix P1: 添加 sudo）
	chmodCmd := fmt.Sprintf("sudo chmod 600 %s", shellQuote(remoteKeyPath))
	if _, err := runSSHCommand(sshClient, chmodCmd); err != nil {
		logger.Warnf("设置密钥文件权限失败: %v", err)
	}

	// 8. 测试 nginx 配置（Fix P1: 添加 sudo）
	testCmd := fmt.Sprintf("sudo %s -t", shellQuote(nginxBin))
	output, err := runSSHCommand(sshClient, testCmd)
	if err != nil {
		return fmt.Errorf("nginx 配置测试失败: %v, 输出: %s", err, output)
	}

	// 9. 重载 nginx（Fix P1: 添加 sudo）
	reloadCmd := fmt.Sprintf("sudo %s -s reload", shellQuote(nginxBin))
	if _, err := runSSHCommand(sshClient, reloadCmd); err != nil {
		return fmt.Errorf("nginx 重载失败: %v", err)
	}

	return nil
}
