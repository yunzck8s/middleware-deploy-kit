package models

import (
	"time"

	"gorm.io/gorm"
)

// MiddlewarePackage 中间件离线包模型
type MiddlewarePackage struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	Name        string    `gorm:"size:100;not null;index" json:"name"`                    // nginx, redis, openssh
	Version     string    `gorm:"size:50;not null" json:"version"`                        // 1.28.0, 6.2.20
	DisplayName string    `gorm:"size:100" json:"display_name"`                           // 显示名称
	Description string    `gorm:"type:text" json:"description"`                           // 描述
	FileName    string    `gorm:"size:255;not null" json:"file_name"`                     // 原始文件名
	FilePath    string    `gorm:"size:500;not null" json:"file_path"`                     // 存储路径
	FileSize    int64     `gorm:"not null" json:"file_size"`                              // 文件大小（字节）
	FileHash    string    `gorm:"size:64" json:"file_hash"`                               // SHA256 哈希
	OSType      string    `gorm:"size:50" json:"os_type"`                                 // rocky, centos, openEuler
	OSVersion   string    `gorm:"size:50" json:"os_version"`                              // 9.4, 7.9
	Status      string    `gorm:"size:20;default:'active'" json:"status"`                 // active, deleted
	UploadedAt  time.Time `gorm:"autoCreateTime" json:"uploaded_at"`                      // 上传时间
	Metadata    string    `gorm:"type:text" json:"metadata,omitempty"`                    // JSON 扩展元数据
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate GORM 钩子：创建前
func (m *MiddlewarePackage) BeforeCreate(tx *gorm.DB) error {
	m.CreatedAt = time.Now()
	m.UpdatedAt = time.Now()
	if m.Status == "" {
		m.Status = "active"
	}
	return nil
}

// BeforeUpdate GORM 钩子：更新前
func (m *MiddlewarePackage) BeforeUpdate(tx *gorm.DB) error {
	m.UpdatedAt = time.Now()
	return nil
}
