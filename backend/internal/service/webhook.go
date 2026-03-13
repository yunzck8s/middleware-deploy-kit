package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

	body, _ := json.Marshal(payload)
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
