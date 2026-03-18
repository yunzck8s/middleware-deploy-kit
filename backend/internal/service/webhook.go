package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
)

type WebhookConfig struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`
	Headers map[string]string `json:"headers"`
	Timeout int               `json:"timeout"`
}

type WebhookService struct{}

func NewWebhookService() *WebhookService {
	return &WebhookService{}
}

func (s *WebhookService) getWebhookConfig() (*WebhookConfig, error) {
	var config models.SystemConfig
	if err := db.DB.Where("key = ?", "webhook_config").First(&config).Error; err != nil {
		return nil, fmt.Errorf("Webhook配置不存在")
	}

	var webhookConfig WebhookConfig
	if err := json.Unmarshal([]byte(config.Value), &webhookConfig); err != nil {
		return nil, err
	}
	return &webhookConfig, nil
}

func (s *WebhookService) Send(payload map[string]interface{}) error {
	config, err := s.getWebhookConfig()
	if err != nil {
		return err
	}

	// 企业微信机器人需要特定消息格式
	var sendPayload interface{}
	if isWeComWebhook(config.URL) {
		content := formatAlertMarkdown(payload)
		sendPayload = map[string]interface{}{
			"msgtype": "markdown",
			"markdown": map[string]string{
				"content": content,
			},
		}
	} else {
		sendPayload = payload
	}

	body, _ := json.Marshal(sendPayload)
	req, err := http.NewRequest(config.Method, config.URL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{Timeout: time.Duration(config.Timeout) * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("webhook返回错误: %d, 响应: %s", resp.StatusCode, string(respBody))
}

// isWeComWebhook 判断是否为企业微信机器人地址
func isWeComWebhook(url string) bool {
	return strings.Contains(url, "qyapi.weixin.qq.com")
}

// formatAlertMarkdown 将告警 payload 格式化为企业微信 markdown
func formatAlertMarkdown(payload map[string]interface{}) string {
	certName, _ := payload["cert_name"].(string)
	domain, _ := payload["domain"].(string)
	expiresAt, _ := payload["expires_at"].(string)
	daysLeft, _ := payload["days_left"].(int)
	if daysLeft == 0 {
		if v, ok := payload["days_left"].(float64); ok {
			daysLeft = int(v)
		}
	}

	// 根据剩余天数选择告警级别颜色
	level := "warning"
	levelText := "即将到期"
	if daysLeft <= 7 {
		level = "warning"
		levelText = "紧急"
	}
	if daysLeft <= 1 {
		level = "warning"
		levelText = "极度紧急"
	}

	displayName := domain
	if displayName == "" {
		displayName = certName
	}

	// 截取日期部分
	if len(expiresAt) > 10 {
		expiresAt = expiresAt[:10]
	}

	return fmt.Sprintf(`🔒 **SSL 证书过期预警 — %s**
> 域名: <font color="%s">%s</font>
> 证书名称: %s
> 到期时间: %s
> 剩余天数: <font color="%s">**%d 天**</font>

请及时续期或替换，避免 HTTPS 服务中断。`, levelText, level, displayName, certName, expiresAt, level, daysLeft)
}
