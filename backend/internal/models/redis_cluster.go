package models

import (
	"time"

	"gorm.io/gorm"
)

// RedisCluster Redis 集群
type RedisCluster struct {
	ID          uint               `gorm:"primaryKey" json:"id"`
	Name        string             `gorm:"size:100;not null" json:"name"`
	Password    string             `gorm:"size:500" json:"-"`                     // 集群密码，不在 API 响应中暴露
	HasPassword bool               `gorm:"-" json:"has_password"`                 // 是否设置了密码（计算字段）
	ClusterMode string             `gorm:"size:20;not null" json:"cluster_mode"`  // "3x2" | "6x1"
	Status      string             `gorm:"size:20;default:'pending'" json:"status"` // pending → deploying → deployed → initializing → running | failed
	TotalNodes  int                `json:"total_nodes"`                           // 固定 6
	PackageID   *uint              `gorm:"index" json:"package_id"`
	Version     string             `gorm:"size:50" json:"version"`
	ErrorMsg    string             `gorm:"type:text" json:"error_msg"`
	Nodes       []RedisClusterNode `gorm:"foreignKey:ClusterID" json:"nodes,omitempty"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

// AfterFind GORM 钩子：查询后填充计算字段
func (c *RedisCluster) AfterFind(tx *gorm.DB) error {
	c.HasPassword = c.Password != ""
	return nil
}

// RedisClusterNode Redis 集群节点（每个 Redis 进程一条记录）
type RedisClusterNode struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ClusterID    uint      `gorm:"not null;index" json:"cluster_id"`
	ServerID     uint      `gorm:"not null;index" json:"server_id"`
	Server       Server    `gorm:"foreignKey:ServerID" json:"server"`
	Port         int       `gorm:"not null" json:"port"`
	Role         string    `gorm:"size:20;default:'pending'" json:"role"`   // pending → master | replica
	NodeID       string    `gorm:"size:50" json:"node_id"`                  // 集群初始化后填充
	InstanceID   *uint     `gorm:"index" json:"instance_id"`
	DeploymentID *uint     `gorm:"index" json:"deployment_id"`
	Status       string    `gorm:"size:20;default:'pending'" json:"status"` // pending → deploying → running | failed
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
