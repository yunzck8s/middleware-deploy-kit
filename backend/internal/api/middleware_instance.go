package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// MiddlewareInstanceAPI 实例管理 API
type MiddlewareInstanceAPI struct {
	cfg           *config.Config
	deploymentAPI *DeploymentAPI
}

// NewMiddlewareInstanceAPI 创建实例 API
func NewMiddlewareInstanceAPI(cfg *config.Config, deploymentAPI *DeploymentAPI) *MiddlewareInstanceAPI {
	return &MiddlewareInstanceAPI{
		cfg:           cfg,
		deploymentAPI: deploymentAPI,
	}
}

// CreateInstanceRequest 创建实例请求
type CreateInstanceRequest struct {
	Name         string                 `json:"name" binding:"required"`
	Type         string                 `json:"type" binding:"required"`
	ServerID     uint                   `json:"server_id" binding:"required"`
	PackageID    uint                   `json:"package_id"`
	Version      string                 `json:"version"`
	InstallPath  string                 `json:"install_path"`
	Environment  string                 `json:"environment"`
	Description  string                 `json:"description"`
	DeployParams map[string]interface{} `json:"deploy_params"`
	AutoDeploy   bool                   `json:"auto_deploy"`
}

// GetMiddlewareInstances 获取中间件实例列表
func (m *MiddlewareInstanceAPI) GetMiddlewareInstances(c *gin.Context) {
	middlewareType := c.Query("type")

	query := db.DB.Preload("Server")
	if middlewareType != "" {
		query = query.Where("type = ?", middlewareType)
	}

	var instances []models.MiddlewareInstance
	if err := query.Find(&instances).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "获取实例列表失败: "+err.Error())
		return
	}

	response.Success(c, instances)
}

// GetMiddlewareInstance 获取单个实例详情
func (m *MiddlewareInstanceAPI) GetMiddlewareInstance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的实例ID")
		return
	}

	var instance models.MiddlewareInstance
	if err := db.DB.Preload("Server").First(&instance, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "实例不存在")
		return
	}

	response.Success(c, instance)
}

// CreateMiddlewareInstance 创建实例
func (m *MiddlewareInstanceAPI) CreateMiddlewareInstance(c *gin.Context) {
	var req CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 如果 InstallPath 为空，从部署参数中提取安装目录
	if req.InstallPath == "" && req.DeployParams != nil {
		// 尝试常见的安装目录参数名
		for _, key := range []string{"NGINX_INSTALL_DIR", "REDIS_INSTALL_DIR", "OPENSSH_INSTALL_DIR", "install_dir", "install_path"} {
			if dir, ok := req.DeployParams[key].(string); ok && dir != "" {
				req.InstallPath = dir
				break
			}
		}
	}

	// 创建实例记录
	instance := models.MiddlewareInstance{
		Name:        req.Name,
		Type:        req.Type,
		ServerID:    req.ServerID,
		Version:     req.Version,
		InstallPath: req.InstallPath,
		Status:      "unknown",
		Environment: req.Environment,
		Description: req.Description,
	}

	// 记录关联的离线包和部署参数，供后续重复部署使用
	if req.PackageID > 0 {
		instance.PackageID = &req.PackageID
	}

	if err := db.DB.Create(&instance).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "创建实例失败: "+err.Error())
		return
	}

	// 保存部署参数到实例记录，供后续点击"部署"时使用
	if req.PackageID > 0 && req.DeployParams != nil {
		deployParamsJSON, err := json.Marshal(req.DeployParams)
		if err != nil {
			logger.Errorf("序列化部署参数失败: %v", err)
		} else {
			db.DB.Model(&instance).Update("deploy_params", string(deployParamsJSON))
		}
	}

	response.Success(c, instance)
}

// UpdateInstanceStatus 更新实例状态
func UpdateInstanceStatus(instanceID uint, status string) error {
	return db.DB.Model(&models.MiddlewareInstance{}).
		Where("id = ?", instanceID).
		Update("status", status).Error
}

// UpdateMiddlewareInstance 更新实例
func (m *MiddlewareInstanceAPI) UpdateMiddlewareInstance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的实例ID")
		return
	}

	var instance models.MiddlewareInstance
	if err := db.DB.First(&instance, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "实例不存在")
		return
	}

	var req models.MiddlewareInstance
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	if err := db.DB.Model(&instance).Updates(req).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "更新实例失败: "+err.Error())
		return
	}

	response.Success(c, instance)
}

// DeleteMiddlewareInstance 删除实例
func (m *MiddlewareInstanceAPI) DeleteMiddlewareInstance(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的实例ID")
		return
	}

	if err := db.DB.Delete(&models.MiddlewareInstance{}, id).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "删除实例失败: "+err.Error())
		return
	}

	// 同步软删除该实例关联的部署记录，避免在统计中误计
	db.DB.Where("instance_id = ?", id).Delete(&models.Deployment{})

	response.Success(c, nil)
}

// GetMiddlewareInstanceStats 获取实例统计
func (m *MiddlewareInstanceAPI) GetMiddlewareInstanceStats(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的实例ID")
		return
	}

	var configCount, certCount, deployCount int64
	db.DB.Model(&models.NginxConfig{}).Where("instance_id = ?", id).Count(&configCount)
	db.DB.Model(&models.Certificate{}).Where("instance_id = ?", id).Count(&certCount)
	db.DB.Model(&models.Deployment{}).Where("instance_id = ?", id).Count(&deployCount)

	var lastDeploy *models.Deployment
	db.DB.Where("instance_id = ?", id).Order("created_at DESC").First(&lastDeploy)

	stats := map[string]interface{}{
		"configs":      configCount,
		"certificates": certCount,
		"deployments":  deployCount,
	}
	if lastDeploy != nil {
		stats["last_deploy"] = lastDeploy.CreatedAt
	}

	response.Success(c, stats)
}

