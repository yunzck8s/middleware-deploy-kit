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

type CertificateAlertAPI struct {
	cfg                 *config.Config
	notificationService *service.NotificationService
}

func NewCertificateAlertAPI(cfg *config.Config, ns *service.NotificationService) *CertificateAlertAPI {
	return &CertificateAlertAPI{
		cfg:                 cfg,
		notificationService: ns,
	}
}

type AlertConfigRequest struct {
	CertificateID   uint     `json:"certificate_id" binding:"required"`
	Enabled         bool     `json:"enabled"`
	ThresholdDays   string   `json:"threshold_days"`
	NotifyInternal  bool     `json:"notify_internal"`
	NotifyEmail     bool     `json:"notify_email"`
	NotifyWebhook   bool     `json:"notify_webhook"`
	EmailRecipients string   `json:"email_recipients"`
}

func (api *CertificateAlertAPI) CreateOrUpdate(c *gin.Context) {
	var req AlertConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}

	var config models.CertificateAlertConfig
	result := db.DB.Where("certificate_id = ?", req.CertificateID).First(&config)

	if result.Error != nil {
		// 创建新配置
		config = models.CertificateAlertConfig{
			CertificateID:   req.CertificateID,
			Enabled:         req.Enabled,
			ThresholdDays:   req.ThresholdDays,
			NotifyInternal:  req.NotifyInternal,
			NotifyEmail:     req.NotifyEmail,
			NotifyWebhook:   req.NotifyWebhook,
			EmailRecipients: req.EmailRecipients,
		}
		if err := db.DB.Create(&config).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "创建失败")
			return
		}
	} else {
		// 更新配置
		config.Enabled = req.Enabled
		config.ThresholdDays = req.ThresholdDays
		config.NotifyInternal = req.NotifyInternal
		config.NotifyEmail = req.NotifyEmail
		config.NotifyWebhook = req.NotifyWebhook
		config.EmailRecipients = req.EmailRecipients
		if err := db.DB.Save(&config).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "更新失败")
			return
		}
	}

	response.Success(c, config)
}

func (api *CertificateAlertAPI) Get(c *gin.Context) {
	certID := c.Param("certificate_id")
	var config models.CertificateAlertConfig
	if err := db.DB.Where("certificate_id = ?", certID).First(&config).Error; err != nil {
		response.Error(c, http.StatusNotFound, "未找到配置")
		return
	}
	response.Success(c, config)
}

func (api *CertificateAlertAPI) TriggerCheck(c *gin.Context) {
	go api.notificationService.CheckCertificateExpiryForce()
	response.Success(c, gin.H{"message": "告警检查已触发"})
}
