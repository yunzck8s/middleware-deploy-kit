package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
)

type NotificationService struct {
	emailService   *EmailService
	webhookService *WebhookService
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		emailService:   NewEmailService(),
		webhookService: NewWebhookService(),
	}
}

// CheckCertificateExpiry 检查证书过期并发送通知
func (s *NotificationService) CheckCertificateExpiry() error {
	return s.checkCertificateExpiryInternal(false)
}

// CheckCertificateExpiryForce 手动触发，跳过去重检查
func (s *NotificationService) CheckCertificateExpiryForce() error {
	return s.checkCertificateExpiryInternal(true)
}

func (s *NotificationService) checkCertificateExpiryInternal(force bool) error {
	logger.Info("开始检查证书过期状态")

	var certs []models.Certificate
	if err := db.DB.Where("status = ?", "active").Find(&certs).Error; err != nil {
		return fmt.Errorf("查询证书失败: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	sent := 0

	for _, cert := range certs {
		var config models.CertificateAlertConfig
		if err := db.DB.Where("certificate_id = ?", cert.ID).First(&config).Error; err != nil {
			logger.Infof("证书 %s (ID=%d) 未配置告警，跳过", cert.Name, cert.ID)
			continue
		}

		if !config.Enabled {
			logger.Infof("证书 %s 告警已禁用，跳过", cert.Name)
			continue
		}

		daysLeft := cert.DaysUntilExpiry()
		logger.Infof("证书 %s 剩余 %d 天", cert.Name, daysLeft)

		if daysLeft < 0 {
			continue // 已过期，跳过
		}

		var thresholds []int
		if err := json.Unmarshal([]byte(config.ThresholdDays), &thresholds); err != nil {
			logger.Errorf("解析阈值失败: %v", err)
			continue
		}

		for _, threshold := range thresholds {
			// 剩余天数小于等于阈值时触发
			if daysLeft <= threshold {
				// 手动触发时跳过去重检查
				if !force {
					var logCount int64
					db.DB.Model(&models.CertificateAlertLog{}).Where(
						"certificate_id = ? AND threshold_days = ? AND alert_date = ?",
						cert.ID, threshold, today,
					).Count(&logCount)

					if logCount > 0 {
						logger.Infof("证书 %s 阈值 %d 天今日已通知，跳过", cert.Name, threshold)
						continue
					}
				}

				// 发送通知
				if config.NotifyInternal {
					s.sendInternalNotification(&cert, daysLeft)
					sent++
					logger.Infof("已为证书 %s 发送站内通知（剩余 %d 天）", cert.Name, daysLeft)
				}

				if config.NotifyEmail {
					var recipients []string
					json.Unmarshal([]byte(config.EmailRecipients), &recipients)
					if len(recipients) > 0 {
						if err := s.emailService.SendCertExpiryAlert(recipients, cert.Name, daysLeft); err != nil {
							logger.Errorf("邮件发送失败: %v", err)
						}
					}
				}

				if config.NotifyWebhook {
					payload := map[string]interface{}{
						"type":       "cert_expiry",
						"cert_name":  cert.Name,
						"domain":     cert.Domain,
						"days_left":  daysLeft,
						"expires_at": cert.ValidUntil.Format("2006-01-02"),
					}
					if err := s.webhookService.Send(payload); err != nil {
						logger.Errorf("Webhook发送失败: %v", err)
					}
				}

				// 记录发送日志
				log := &models.CertificateAlertLog{
					CertificateID: cert.ID,
					ThresholdDays: threshold,
					AlertDate:     today,
					NotifiedAt:    time.Now(),
				}
				db.DB.Create(log)
			}
		}
	}

	logger.Infof("证书过期检查完成，共发送 %d 条通知", sent)
	return nil
}

func (s *NotificationService) sendInternalNotification(cert *models.Certificate, daysLeft int) {
	notification := &models.Notification{
		Type:        "cert_expiry",
		Title:       fmt.Sprintf("证书即将过期: %s", cert.Name),
		Content:     fmt.Sprintf("证书 %s 将在 %d 天后过期，请及时续期", cert.Name, daysLeft),
		Status:      "unread",
		RelatedType: "certificate",
		RelatedID:   cert.ID,
	}
	db.DB.Create(notification)
}
