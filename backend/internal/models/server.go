package models

import (
	"time"

	"gorm.io/gorm"
)

// Server 服务器模型
type Server struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"not null;index"`                // 服务器名称
	Host        string         `json:"host" gorm:"not null"`                      // 主机地址（IP或域名）
	Port        int            `json:"port" gorm:"default:22"`                    // SSH 端口
	Username    string         `json:"username" gorm:"not null"`                  // SSH 用户名
	AuthType    string         `json:"auth_type" gorm:"default:'password'"`       // 认证方式：password, key
	Password    string         `json:"-" gorm:""`                                 // SSH 密码（加密存储）
	PrivateKey  string         `json:"-" gorm:"type:text"`                        // SSH 私钥（加密存储）
	Passphrase  string         `json:"-" gorm:""`                                 // 私钥密码（加密存储）
	OSType      string         `json:"os_type" gorm:""`                           // 操作系统类型：rocky, centos, openEuler, kylin
	OSVersion   string         `json:"os_version" gorm:""`                        // 操作系统版本
	Description string         `json:"description" gorm:""`                       // 描述
	Tags        string         `json:"tags" gorm:""`                              // 标签（JSON 数组）
	Status      string         `json:"status" gorm:"default:'unknown'"`           // 状态：online, offline, unknown
	LastCheckAt *time.Time     `json:"last_check_at" gorm:""`                     // 最后检查时间
	LastCheckMsg string        `json:"last_check_msg" gorm:""`                    // 最后检查结果消息
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName 表名
func (Server) TableName() string {
	return "servers"
}

// ServerGroup 服务器分组
type ServerGroup struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"not null;uniqueIndex"`
	Description string         `json:"description"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// ServerGroupMapping 服务器与分组的关联
type ServerGroupMapping struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ServerID  uint      `json:"server_id" gorm:"not null;index"`
	GroupID   uint      `json:"group_id" gorm:"not null;index"`
	CreatedAt time.Time `json:"created_at"`
}

// IsOnline 检查服务器是否在线
func (s *Server) IsOnline() bool {
	return s.Status == "online"
}

// GetDisplayStatus 获取显示状态
func (s *Server) GetDisplayStatus() string {
	switch s.Status {
	case "online":
		return "在线"
	case "offline":
		return "离线"
	default:
		return "未知"
	}
}
