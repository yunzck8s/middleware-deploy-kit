package api

import (
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
	Name   string `form:"name" binding:"required"`   // 证书名称
	Domain string `form:"domain"`                    // 域名
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

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		logger.Errorf("解析证书失败: %v", err)
		cleanupCertFiles(certPath, keyPath)
		response.BadRequest(c, "无效的证书文件: "+err.Error())
		return
	}

	// 验证证书和密钥是否匹配（可选，需要额外实现）
	// TODO: 添加证书和密钥匹配验证

	// 检查证书名称是否已存在
	var existingCert models.Certificate
	result := db.DB.Where("name = ? AND status = 'active'", req.Name).First(&existingCert)
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
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var certificates []models.Certificate
	query := db.DB.Where("status != ?", "deleted")

	if status != "" {
		query = query.Where("status = ?", status)
	}

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

	// 更新过期状态
	now := time.Now()
	for i := range certificates {
		if certificates[i].Status == "active" && now.After(certificates[i].ValidUntil) {
			certificates[i].Status = "expired"
			db.DB.Save(&certificates[i])
		}
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

	// 更新过期状态
	if cert.Status == "active" && time.Now().After(cert.ValidUntil) {
		cert.Status = "expired"
		db.DB.Save(&cert)
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

	// 软删除：更新状态为 deleted
	cert.Status = "deleted"
	if err := db.DB.Save(&cert).Error; err != nil {
		logger.Errorf("删除证书失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

	// 可选：删除物理文件
	// cleanupCertFiles(cert.CertFilePath, cert.KeyFilePath)

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
