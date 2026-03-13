package models

import (
	"time"

	"gorm.io/gorm"
)

type Notification struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Type        string         `gorm:"type:varchar(50);not null;index" json:"type"` // cert_expiry, system
	Title       string         `gorm:"type:varchar(255);not null" json:"title"`
	Content     string         `gorm:"type:text" json:"content"`
	Status      string         `gorm:"type:varchar(20);not null;default:'unread';index" json:"status"` // unread, read, deleted
	RelatedType string         `gorm:"type:varchar(50)" json:"related_type"`                           // certificate, deployment
	RelatedID   uint           `json:"related_id"`
	ReadAt      *time.Time     `json:"read_at"`
}
