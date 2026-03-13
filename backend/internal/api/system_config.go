package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/service"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

type SystemConfigAPI struct {
	cfg *config.Config
}

func NewSystemConfigAPI(cfg *config.Config) *SystemConfigAPI {
	return &SystemConfigAPI{cfg: cfg}
}

type ConfigRequest struct {
	Key      string `json:"key" binding:"required"`
	Value    string `json:"value" binding:"required"`
	Category string `json:"category"`
}

func (api *SystemConfigAPI) Set(c *gin.Context) {
	var req ConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var config models.SystemConfig
	result := db.DB.Where("key = ?", req.Key).First(&config)

	if result.Error != nil {
		config = models.SystemConfig{
			Key:      req.Key,
			Value:    req.Value,
			Category: req.Category,
		}
		if err := db.DB.Create(&config).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "创建失败")
			return
		}
	} else {
		config.Value = req.Value
		config.Category = req.Category
		if err := db.DB.Save(&config).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "更新失败")
			return
		}
	}

	response.Success(c, config)
}

func (api *SystemConfigAPI) Get(c *gin.Context) {
	key := c.Param("key")
	var config models.SystemConfig
	if err := db.DB.Where("key = ?", key).First(&config).Error; err != nil {
		response.Error(c, http.StatusNotFound, "配置不存在")
		return
	}
	response.Success(c, config)
}

func (api *SystemConfigAPI) TestSMTP(c *gin.Context) {
	var config models.SystemConfig
	if err := db.DB.Where("key = ?", "smtp_config").First(&config).Error; err != nil {
		response.Error(c, http.StatusNotFound, "SMTP配置不存在")
		return
	}

	emailService := service.NewEmailService()
	if err := emailService.SendCertExpiryAlert([]string{"test@example.com"}, "测试证书", 7); err != nil {
		response.Error(c, http.StatusInternalServerError, "发送失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "测试邮件已发送"})
}

func (api *SystemConfigAPI) TestWebhook(c *gin.Context) {
	var config models.SystemConfig
	if err := db.DB.Where("key = ?", "webhook_config").First(&config).Error; err != nil {
		response.Error(c, http.StatusNotFound, "Webhook配置不存在")
		return
	}

	webhookService := service.NewWebhookService()
	payload := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]interface{}{
			"content": "【测试消息】证书过期通知系统测试\n这是一条来自 Nginx 运维控制台的测试消息",
		},
	}

	if err := webhookService.Send(payload); err != nil {
		response.Error(c, http.StatusInternalServerError, "发送失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{"message": "测试消息已发送"})
}
