package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// DeploymentScriptAPI 部署脚本 API
type DeploymentScriptAPI struct {
	config *config.Config
}

// NewDeploymentScriptAPI 创建部署脚本 API 实例
func NewDeploymentScriptAPI(cfg *config.Config) *DeploymentScriptAPI {
	return &DeploymentScriptAPI{config: cfg}
}

// Create 创建脚本模板
func (a *DeploymentScriptAPI) Create(c *gin.Context) {
	var req models.DeploymentScript
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 验证必填字段
	if req.Name == "" {
		response.Error(c, http.StatusBadRequest, "脚本名称不能为空")
		return
	}
	if req.Content == "" {
		response.Error(c, http.StatusBadRequest, "脚本内容不能为空")
		return
	}

	// 设置默认值
	if req.ScriptType == "" {
		req.ScriptType = "shell"
	}
	if req.Category == "" {
		req.Category = "custom"
	}
	if req.Status == "" {
		req.Status = "active"
	}
	if req.Timeout == 0 {
		req.Timeout = 300
	}

	// 创建脚本
	if err := db.DB.Create(&req).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "创建脚本失败: "+err.Error())
		return
	}

	response.Success(c, req)
}

// List 获取脚本模板列表
func (a *DeploymentScriptAPI) List(c *gin.Context) {
	var scripts []models.DeploymentScript

	query := db.DB.Model(&models.DeploymentScript{})

	// 过滤条件
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if osType := c.Query("os_type"); osType != "" {
		query = query.Where("os_type = ? OR os_type = ''", osType)
	}

	// 分页
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	offset := (page - 1) * pageSize

	var total int64
	query.Count(&total)

	// 查询数据
	if err := query.Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&scripts).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "查询脚本列表失败")
		return
	}

	response.Success(c, gin.H{
		"scripts":   scripts,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// Get 获取脚本模板详情
func (a *DeploymentScriptAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的脚本ID")
		return
	}

	var script models.DeploymentScript
	if err := db.DB.First(&script, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "脚本不存在")
		return
	}

	response.Success(c, script)
}

// Update 更新脚本模板
func (a *DeploymentScriptAPI) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的脚本ID")
		return
	}

	var script models.DeploymentScript
	if err := db.DB.First(&script, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "脚本不存在")
		return
	}

	var req models.DeploymentScript
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	// 更新字段
	updates := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"category":    req.Category,
		"os_type":     req.OSType,
		"os_version":  req.OSVersion,
		"script_type": req.ScriptType,
		"content":     req.Content,
		"timeout":     req.Timeout,
		"work_dir":    req.WorkDir,
		"variables":   req.Variables,
		"status":      req.Status,
	}

	if err := db.DB.Model(&script).Updates(updates).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "更新脚本失败")
		return
	}

	response.Success(c, script)
}

// Delete 删除脚本模板
func (a *DeploymentScriptAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的脚本ID")
		return
	}

	var script models.DeploymentScript
	if err := db.DB.First(&script, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "脚本不存在")
		return
	}

	// 检查是否有关联的钩子在使用
	var hookCount int64
	db.DB.Model(&models.DeploymentHook{}).Where("script_id = ?", id).Count(&hookCount)
	if hookCount > 0 {
		response.Error(c, http.StatusBadRequest, "该脚本正在被使用，无法删除")
		return
	}

	if err := db.DB.Delete(&script).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "删除脚本失败")
		return
	}

	response.Success(c, gin.H{"message": "删除成功"})
}
