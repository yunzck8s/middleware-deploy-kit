package models

import (
	"time"

	"gorm.io/gorm"
)

type SystemConfig struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	Key       string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"key"` // smtp_config, webhook_config
	Value     string         `gorm:"type:text" json:"value"`                            // JSON
	Category  string         `gorm:"type:varchar(50);index" json:"category"`            // smtp, webhook, alert
}
