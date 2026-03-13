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
	logger.Info("开始检查证书过期状态")

	var certs []models.Certificate
	if err := db.DB.Where("status = ?", "active").Find(&certs).Error; err != nil {
		return fmt.Errorf("查询证书失败: %w", err)
	}

	today := time.Now().Format("2006-01-02")

	for _, cert := range certs {
		var config models.CertificateAlertConfig
		if err := db.DB.Where("certificate_id = ?", cert.ID).First(&config).Error; err != nil {
			continue // 未配置告警，跳过
		}

		if !config.Enabled {
			continue
		}

		daysLeft := cert.DaysUntilExpiry()
		if daysLeft < 0 {
			continue // 已过期，跳过
		}

		var thresholds []int
		if err := json.Unmarshal([]byte(config.ThresholdDays), &thresholds); err != nil {
			logger.Error("解析阈值失败: %v", err)
			continue
		}

		for _, threshold := range thresholds {
			// 只在接近阈值时触发（阈值当天或前一天）
			if daysLeft >= threshold-1 && daysLeft <= threshold {
				// 检查是否已为此阈值发送过通知
				var logCount int64
				db.DB.Model(&models.CertificateAlertLog{}).Where(
					"certificate_id = ? AND threshold_days = ?",
					cert.ID, threshold,
				).Count(&logCount)

				if logCount > 0 {
					continue // 已发送过此阈值通知，跳过
				}

				// 发送通知
				if config.NotifyInternal {
					s.sendInternalNotification(&cert, daysLeft)
				}

				if config.NotifyEmail {
					var recipients []string
					json.Unmarshal([]byte(config.EmailRecipients), &recipients)
					if len(recipients) > 0 {
						if err := s.emailService.SendCertExpiryAlert(recipients, cert.Name, daysLeft); err != nil {
							logger.Error("邮件发送失败: %v", err)
						}
					}
				}

				if config.NotifyWebhook {
					payload := map[string]interface{}{
						"type":       "cert_expiry",
						"cert_name":  cert.Name,
						"days_left":  daysLeft,
						"expires_at": cert.ValidUntil,
					}
					if err := s.webhookService.Send(payload); err != nil {
						logger.Error("Webhook发送失败: %v", err)
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

	logger.Info("证书过期检查完成")
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
