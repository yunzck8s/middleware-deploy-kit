package models

import "time"

// MiddlewareInstance 中间件实例模型
type MiddlewareInstance struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Type        string    `gorm:"size:50;not null;index" json:"type"`
	ServerID    uint      `gorm:"not null;index" json:"server_id"`
	Server      Server    `gorm:"foreignKey:ServerID" json:"server"`
	PackageID   *uint     `gorm:"index" json:"package_id,omitempty"`   // 创建时使用的离线包
	Version     string    `gorm:"size:50" json:"version"`
	InstallPath string    `gorm:"size:255" json:"install_path"`
	DeployParams string   `gorm:"type:text" json:"deploy_params"`      // 部署参数（JSON 格式）
	Status      string    `gorm:"size:20;default:'unknown'" json:"status"`
	Environment string    `gorm:"size:50" json:"environment"`
	Description string    `gorm:"size:500" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
