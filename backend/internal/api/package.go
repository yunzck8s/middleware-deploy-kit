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
	Name        string `form:"name" binding:"required"`       // nginx
	Version     string `form:"version" binding:"required"`    // 版本号
	DisplayName string `form:"display_name"`                  // 显示名称
	Description string `form:"description"`                   // 描述
	OSType      string `form:"os_type" binding:"required"`    // rocky, centos, openEuler
	OSVersion   string `form:"os_version" binding:"required"` // 9.4, 7.9
}

type packageIdentity struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
}

// Upload 上传离线包
func (p *PackageAPI) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		logger.Errorf("获取上传文件失败: %v", err)
		response.BadRequest(c, "未找到上传文件")
		return
	}

	name := strings.TrimSpace(c.PostForm("name"))
	version := strings.TrimSpace(c.PostForm("version"))
	displayName := strings.TrimSpace(c.PostForm("display_name"))
	description := strings.TrimSpace(c.PostForm("description"))
	osType := strings.TrimSpace(c.PostForm("os_type"))
	osVersion := strings.TrimSpace(c.PostForm("os_version"))

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

	if req.Name != models.MiddlewareNameNginx {
		response.BadRequest(c, "当前仅支持上传 Nginx 离线包")
		return
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".zip") {
		response.BadRequest(c, "只支持 ZIP 格式文件")
		return
	}

	maxSize := int64(500 * 1024 * 1024)
	if file.Size > maxSize {
		response.BadRequest(c, "文件大小超过限制（最大 500MB）")
		return
	}

	uploadDir := filepath.Join(p.cfg.Data.UploadDir, "packages")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		logger.Errorf("创建上传目录失败: %v", err)
		response.InternalServerError(c, "创建上传目录失败")
		return
	}

	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%s-%s-%s-%s-%d.zip", req.Name, req.Version, req.OSType, req.OSVersion, timestamp)
	filePath := filepath.Join(uploadDir, filename)

	src, err := file.Open()
	if err != nil {
		logger.Errorf("打开上传文件失败: %v", err)
		response.InternalServerError(c, "打开上传文件失败")
		return
	}
	defer src.Close()

	dst, err := os.Create(filePath)
	if err != nil {
		logger.Errorf("创建目标文件失败: %v", err)
		response.InternalServerError(c, "创建目标文件失败")
		return
	}

	hash := sha256.New()
	writer := io.MultiWriter(dst, hash)
	if _, err := io.Copy(writer, src); err != nil {
		dst.Close()
		logger.Errorf("保存文件失败: %v", err)
		os.Remove(filePath)
		response.InternalServerError(c, "保存文件失败")
		return
	}

	if err := dst.Close(); err != nil {
		logger.Errorf("关闭上传文件失败: %v", err)
		os.Remove(filePath)
		response.InternalServerError(c, "保存文件失败")
		return
	}

	identity, err := readPackageIdentity(filePath)
	if err != nil {
		os.Remove(filePath)
		response.BadRequest(c, "离线包 metadata.json 校验失败: "+err.Error())
		return
	}

	if identity.Name != models.MiddlewareNameNginx {
		os.Remove(filePath)
		response.BadRequest(c, "ZIP 包中的 metadata.json 必须声明为 nginx")
		return
	}
	if identity.Version == "" {
		os.Remove(filePath)
		response.BadRequest(c, "ZIP 包中的 metadata.json 缺少 version")
		return
	}
	if identity.Version != req.Version {
		os.Remove(filePath)
		response.BadRequest(c, "请求版本与 ZIP 包 metadata.json 中的 version 不一致")
		return
	}

	fileHash := hex.EncodeToString(hash.Sum(nil))

	var existingPkg models.MiddlewarePackage
	result := db.DB.Where("name = ? AND version = ? AND os_type = ? AND os_version = ? AND status = 'active'",
		req.Name, req.Version, req.OSType, req.OSVersion).First(&existingPkg)
	if result.Error == nil {
		os.Remove(filePath)
		response.ConflictWithData(c, "该离线包已存在", gin.H{
			"existing_package": existingPkg,
		})
		return
	}

	if req.DisplayName == "" {
		req.DisplayName = strings.TrimSpace(identity.DisplayName)
	}
	if req.Description == "" {
		req.Description = strings.TrimSpace(identity.Description)
	}

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

	if pkg.DisplayName == "" {
		pkg.DisplayName = fmt.Sprintf("%s %s", strings.ToUpper(req.Name), req.Version)
	}

	if err := db.DB.Create(pkg).Error; err != nil {
		logger.Errorf("创建离线包记录失败: %v", err)
		os.Remove(filePath)
		response.InternalServerError(c, "创建离线包记录失败")
		return
	}

	logger.Infof("离线包上传成功: %s-%s (%s)", pkg.Name, pkg.Version, pkg.FileName)
	response.SuccessWithMessage(c, "上传成功", pkg)
}

// List 获取离线包列表
func (p *PackageAPI) List(c *gin.Context) {
	name := strings.TrimSpace(c.Query("name"))
	osType := strings.TrimSpace(c.Query("os_type"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	if name != "" && name != models.MiddlewareNameNginx {
		response.BadRequest(c, "当前仅支持查询 Nginx 离线包")
		return
	}

	var packages []models.MiddlewarePackage
	query := db.DB.Where("status = ? AND name = ?", "active", models.MiddlewareNameNginx)

	if osType != "" {
		query = query.Where("os_type = ?", osType)
	}

	var total int64
	query.Model(&models.MiddlewarePackage{}).Count(&total)

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

	pkg, err := findActiveNginxPackage(uint(id))
	if err != nil {
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

	pkg, err := findActiveNginxPackage(uint(id))
	if err != nil {
		response.NotFound(c, "离线包不存在")
		return
	}

	pkg.Status = "deleted"
	if err := db.DB.Save(pkg).Error; err != nil {
		logger.Errorf("删除离线包失败: %v", err)
		response.InternalServerError(c, "删除失败")
		return
	}

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

	pkg, err := findActiveNginxPackage(uint(id))
	if err != nil {
		response.NotFound(c, "离线包不存在")
		return
	}

	if _, err := os.Stat(pkg.FilePath); os.IsNotExist(err) {
		response.NotFound(c, "离线包文件不存在")
		return
	}

	metadata, err := readPackageMetadata(pkg.FilePath)
	if err != nil {
		logger.Errorf("读取离线包元数据失败: %v", err)
		response.InternalServerError(c, "解析元数据失败")
		return
	}

	response.Success(c, metadata)
}

func findActiveNginxPackage(id uint) (*models.MiddlewarePackage, error) {
	var pkg models.MiddlewarePackage
	if err := db.DB.Where("id = ? AND name = ? AND status = ?", id, models.MiddlewareNameNginx, "active").First(&pkg).Error; err != nil {
		return nil, err
	}
	return &pkg, nil
}

func readPackageMetadata(filePath string) (*models.PackageMetadata, error) {
	metadataJSON, err := readPackageMetadataJSON(filePath)
	if err != nil {
		return nil, err
	}

	var metadata models.PackageMetadata
	if err := json.Unmarshal(metadataJSON, &metadata); err != nil {
		return nil, err
	}

	return &metadata, nil
}

func readPackageIdentity(filePath string) (*packageIdentity, error) {
	metadataJSON, err := readPackageMetadataJSON(filePath)
	if err != nil {
		return nil, err
	}

	var identity packageIdentity
	if err := json.Unmarshal(metadataJSON, &identity); err != nil {
		return nil, err
	}

	return &identity, nil
}

func readPackageMetadataJSON(filePath string) ([]byte, error) {
	zipReader, err := zip.OpenReader(filePath)
	if err != nil {
		return nil, err
	}
	defer zipReader.Close()

	for _, file := range zipReader.File {
		if !strings.HasSuffix(file.Name, "metadata.json") {
			continue
		}

		rc, err := file.Open()
		if err != nil {
			return nil, err
		}

		metadataJSON, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}

		return metadataJSON, nil
	}

	return nil, fmt.Errorf("离线包中未找到 metadata.json")
}
