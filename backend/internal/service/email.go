package service

import (
	"crypto/tls"
	"encoding/json"
	"fmt"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"gopkg.in/gomail.v2"
)

type SMTPConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	From     string `json:"from"`
	UseTLS   bool   `json:"use_tls"`
}

type EmailService struct{}

func NewEmailService() *EmailService {
	return &EmailService{}
}

func (s *EmailService) getSMTPConfig() (*SMTPConfig, error) {
	var config models.SystemConfig
	if err := db.DB.Where("key = ?", "smtp_config").First(&config).Error; err != nil {
		return nil, fmt.Errorf("SMTP配置不存在")
	}

	var smtpConfig SMTPConfig
	if err := json.Unmarshal([]byte(config.Value), &smtpConfig); err != nil {
		return nil, err
	}
	return &smtpConfig, nil
}

func (s *EmailService) SendCertExpiryAlert(to []string, certName string, daysLeft int) error {
	config, err := s.getSMTPConfig()
	if err != nil {
		return err
	}

	m := gomail.NewMessage()
	m.SetHeader("From", config.From)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", fmt.Sprintf("证书过期提醒: %s", certName))
	m.SetBody("text/html", fmt.Sprintf(`
		<h3>证书即将过期</h3>
		<p>证书 <strong>%s</strong> 将在 <strong>%d</strong> 天后过期，请及时续期。</p>
	`, certName, daysLeft))

	d := gomail.NewDialer(config.Host, config.Port, config.Username, config.Password)
	if config.UseTLS {
		d.TLSConfig = &tls.Config{InsecureSkipVerify: true}
	}

	return d.DialAndSend(m)
}
