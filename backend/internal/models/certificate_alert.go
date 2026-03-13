package models

import (
	"time"

	"gorm.io/gorm"
)

type CertificateAlertConfig struct {
	ID             uint           `gorm:"primarykey" json:"id"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	CertificateID  uint           `gorm:"uniqueIndex;not null" json:"certificate_id"`
	Enabled        bool           `gorm:"default:true" json:"enabled"`
	ThresholdDays  string         `gorm:"type:text" json:"threshold_days"` // JSON array: [30,7,1]
	NotifyInternal bool           `gorm:"default:true" json:"notify_internal"`
	NotifyEmail    bool           `gorm:"default:false" json:"notify_email"`
	NotifyWebhook  bool           `gorm:"default:false" json:"notify_webhook"`
	EmailRecipients string        `gorm:"type:text" json:"email_recipients"` // JSON array
}

type CertificateAlertLog struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	CertificateID uint      `gorm:"not null;index:idx_cert_alert_dedup" json:"certificate_id"`
	ThresholdDays int       `gorm:"not null;index:idx_cert_alert_dedup" json:"threshold_days"`
	AlertDate     string    `gorm:"type:varchar(10);not null;index:idx_cert_alert_dedup" json:"alert_date"` // YYYY-MM-DD
	NotifiedAt    time.Time `json:"notified_at"`
}
