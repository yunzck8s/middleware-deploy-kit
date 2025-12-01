package api

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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

// PackageAPI 离线包管理 API
type PackageAPI struct {
	cfg *config.Config
}

// NewPackageAPI 创建离线包 API 实例
func NewPackageAPI(cfg *config.Config) *PackageAPI {
	return &PackageAPI{cfg: cfg}
}

// UploadRequest 上传请求
type UploadRequest struct {
	Name        string `form:"name" binding:"required"`        // nginx, redis, openssh
	Version     string `form:"version" binding:"required"`     // 版本号
	DisplayName string `form:"display_name"`                   // 显示名称
	Description string `form:"description"`                    // 描述
	OSType      string `form:"os_type" binding:"required"`     // rocky, centos, openEuler
	OSVersion   string `form:"os_version" binding:"required"`  // 9.4, 7.9
}

// Upload 上传离线包
func (p *PackageAPI) Upload(c *gin.Context) {
	// 获取上传的文件
	file, err := c.FormFile("file")
	if err != nil {
		logger.Errorf("获取上传文件失败: %v", err)
		response.BadRequest(c, "未找到上传文件")
		return
	}

	// 手动获取表单字段（multipart/form-data）
	name := c.PostForm("name")
	version := c.PostForm("version")
	displayName := c.PostForm("display_name")
	description := c.PostForm("description")
	osType := c.PostForm("os_type")
	osVersion := c.PostForm("os_version")

	// 验证必填字段
	if name == "" || version == "" || osType == "" || osVersion == "" {
		response.BadRequest(c, "缺少必填字段: name, version, os_type, os_version")
		return
	}

	req := UploadRequest{
		Name:        name,
		Version:     version,
		DisplayName: displayName,
		Description: description,
		OSType:      osType,
		OSVersion:   osVersion,
	}

	// 验证文件类型（必须是 zip）
	if !strings.HasSuffix(strings.ToLower(file.Filename), ".zip") {
		response.BadRequest(c, "只支持 ZIP 格式文件")
		return
	}

	// 验证文件大小（最大 500MB）
	maxSize := int64(500 * 1024 * 1024) // 500MB
	if file.Size > maxSize {
		response.BadRequest(c, "文件大小超过限制（最大 500MB）")
		return
	}

	// 创建存储目录
	uploadDir := filepath.Join(p.cfg.Data.UploadDir, "packages")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		logger.Errorf("创建上传目录失败: %v", err)
		response.InternalServerError(c, "创建上传目录失败")
		return
	}

	// 生成文件名：{name}-{version}-{os_type}-{os_version}-{timestamp}.zip
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%s-%s-%s-%s-%d.zip",
		req.Name, req.Version, req.OSType, req.OSVersion, timestamp)
	filePath := filepath.Join(uploadDir, filename)

	// 打开上传的文件
	src, err := file.Open()
	if err != nil {
		logger.Errorf("打开上传文件失败: %v", err)
		response.InternalServerError(c, "打开上传文件失败")
		return
	}
	defer src.Close()

	// 创建目标文件
	dst, err := os.Create(filePath)
	if err != nil {
		logger.Errorf("创建目标文件失败: %v", err)
		response.InternalServerError(c, "创建目标文件失败")
		return
	}
	defer dst.Close()

	// 计算 SHA256 并保存文件
	hash := sha256.New()
	writer := io.MultiWriter(dst, hash)
	if _, err := io.Copy(writer, src); err != nil {
		logger.Errorf("保存文件失败: %v", err)
		os.Remove(filePath) // 清理失败的文件
		response.InternalServerError(c, "保存文件失败")
		return
	}

	// 获取文件哈希
	fileHash := hex.EncodeToString(hash.Sum(nil))

	// 检查是否已存在相同的包（相同名称、版本、OS）
	var existingPkg models.MiddlewarePackage
	result := db.DB.Where("name = ? AND version = ? AND os_type = ? AND os_version = ? AND status = 'active'",
		req.Name, req.Version, req.OSType, req.OSVersion).First(&existingPkg)

	if result.Error == nil {
		// 已存在，删除新上传的文件
		os.Remove(filePath)
		response.ConflictWithData(c, "该离线包已存在", gin.H{
			"existing_package": existingPkg,
		})
		return
	}

	// 创建数据库记录
	pkg := &models.MiddlewarePackage{
		Name:        req.Name,
		Version:     req.Version,
		DisplayName: req.DisplayName,
		Description: req.Description,
		FileName:    file.Filename,
		FilePath:    filePath,
		FileSize:    file.Size,
		FileHash:    fileHash,
		OSType:      req.OSType,
		OSVersion:   req.OSVersion,
		Status:      "active",
	}

	// 设置默认显示名称
	if pkg.DisplayName == "" {
		pkg.DisplayName = fmt.Sprintf("%s %s", strings.ToUpper(req.Name), req.Version)
	}

	if err := db.DB.Create(pkg).Error; err != nil {
		logger.Errorf("创建离线包记录失败: %v", err)
		os.Remove(filePath) // 清理文件
		response.InternalServerError(c, "创建离线包记录失败")
		return
	}

	logger.Infof("离线包上传成功: %s-%s (%s)", pkg.Name, pkg.Version, pkg.FileName)
	response.SuccessWithMessage(c, "上传成功", pkg)
}

// List 获取离线包列表
func (p *PackageAPI) List(c *gin.Context) {
	name := c.Query("name")       // 筛选中间件名称
	osType := c.Query("os_type")  // 筛选操作系统类型
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var packages []models.MiddlewarePackage
	query := db.DB.Where("status = ?", "active")

	if name != "" {
		query = query.Where("name = ?", name)
	}
	if osType != "" {
		query = query.Where("os_type = ?", osType)
	}

	// 获取总数
	var total int64
	query.Model(&models.MiddlewarePackage{}).Count(&total)

	// 分页查询
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&packages).Error; err != nil {
		logger.Errorf("查询离线包列表失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, gin.H{
		"packages":  packages,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// Get 获取离线包详情
func (p *PackageAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var pkg models.MiddlewarePackage
	if err := db.DB.First(&pkg, id).Error; err != nil {
		response.NotFound(c, "离线包不存在")
		return
	}

	response.Success(c, pkg)
}

// Delete 删除离线包
func (p *PackageAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var pkg models.MiddlewarePackage
	if err := db.DB.First(&pkg, id).Error; err != nil {
		response.NotFound(c, "离线包不存在")
		return
	}

	// 软删除：更新状态为 deleted
	pkg.Status = "deleted"
	if err := db.DB.Save(&pkg).Error; err != nil {
		logger.Errorf("删除离线包失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

	// 可选：删除物理文件（如果需要立即释放磁盘空间）
	// if err := os.Remove(pkg.FilePath); err != nil {
	// 	logger.Warnf("删除文件失败: %v", err)
	// }

	logger.Infof("离线包已删除: %s-%s (ID: %d)", pkg.Name, pkg.Version, pkg.ID)
	response.SuccessWithMessage(c, "删除成功", nil)
}

// GetMetadata 获取离线包的 metadata.json
func (p *PackageAPI) GetMetadata(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var pkg models.MiddlewarePackage
	if err := db.DB.First(&pkg, id).Error; err != nil {
		response.NotFound(c, "离线包不存在")
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(pkg.FilePath); os.IsNotExist(err) {
		response.NotFound(c, "离线包文件不存在")
		return
	}

	// 打开 ZIP 文件
	zipReader, err := zip.OpenReader(pkg.FilePath)
	if err != nil {
		logger.Errorf("打开 ZIP 文件失败: %v", err)
		response.InternalServerError(c, "打开离线包失败")
		return
	}
	defer zipReader.Close()

	// 查找 metadata.json 文件
	var metadataFile *zip.File
	for _, file := range zipReader.File {
		if strings.HasSuffix(file.Name, "metadata.json") {
			metadataFile = file
			break
		}
	}

	if metadataFile == nil {
		response.NotFound(c, "离线包中未找到 metadata.json")
		return
	}

	// 读取 metadata.json 内容
	rc, err := metadataFile.Open()
	if err != nil {
		logger.Errorf("打开 metadata.json 失败: %v", err)
		response.InternalServerError(c, "读取元数据失败")
		return
	}
	defer rc.Close()

	// 解析 JSON
	var metadata models.PackageMetadata
	decoder := json.NewDecoder(rc)
	if err := decoder.Decode(&metadata); err != nil {
		logger.Errorf("解析 metadata.json 失败: %v", err)
		response.InternalServerError(c, "解析元数据失败")
		return
	}

	response.Success(c, metadata)
}
