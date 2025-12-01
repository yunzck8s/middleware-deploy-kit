package models

import (
	"time"

	"gorm.io/gorm"
)

// Certificate SSL证书模型
type Certificate struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	Name         string    `gorm:"size:100;not null;uniqueIndex" json:"name"`      // 证书名称
	Domain       string    `gorm:"size:255" json:"domain"`                         // 域名
	CertFilePath string    `gorm:"size:500;not null" json:"cert_file_path"`        // .crt 文件路径
	KeyFilePath  string    `gorm:"size:500;not null" json:"key_file_path"`         // .key 文件路径
	ValidFrom    time.Time `json:"valid_from"`                                     // 有效期开始
	ValidUntil   time.Time `json:"valid_until"`                                    // 有效期结束
	Issuer       string    `gorm:"size:255" json:"issuer"`                         // 颁发者
	Subject      string    `gorm:"size:255" json:"subject"`                        // 主题
	Status       string    `gorm:"size:20;default:'active'" json:"status"`         // active, expired, deleted
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BeforeCreate GORM 钩子：创建前
func (c *Certificate) BeforeCreate(tx *gorm.DB) error {
	c.CreatedAt = time.Now()
	c.UpdatedAt = time.Now()
	if c.Status == "" {
		c.Status = "active"
	}
	return nil
}

// BeforeUpdate GORM 钩子：更新前
func (c *Certificate) BeforeUpdate(tx *gorm.DB) error {
	c.UpdatedAt = time.Now()
	return nil
}

// IsExpired 检查证书是否过期
func (c *Certificate) IsExpired() bool {
	return time.Now().After(c.ValidUntil)
}

// DaysUntilExpiry 距离过期还有多少天
func (c *Certificate) DaysUntilExpiry() int {
	if c.IsExpired() {
		return 0
	}
	duration := time.Until(c.ValidUntil)
	return int(duration.Hours() / 24)
}
