package models

import (
	"time"

	"gorm.io/gorm"
)

// DeploymentType 部署类型
type DeploymentType string

const (
	DeployTypeNginxConfig DeploymentType = "nginx_config" // Nginx 配置部署
	DeployTypePackage     DeploymentType = "package"      // 中间件包部署
	DeployTypeCertificate DeploymentType = "certificate"  // 证书部署
)

// DeploymentStatus 部署状态
type DeploymentStatus string

const (
	DeployStatusPending   DeploymentStatus = "pending"    // 待执行
	DeployStatusRunning   DeploymentStatus = "running"    // 执行中
	DeployStatusSuccess   DeploymentStatus = "success"    // 成功
	DeployStatusFailed    DeploymentStatus = "failed"     // 失败
	DeployStatusCancelled DeploymentStatus = "cancelled"  // 已取消
)

// Deployment 部署任务
type Deployment struct {
	ID          uint             `json:"id" gorm:"primaryKey"`
	Name        string           `json:"name" gorm:"not null"`                          // 部署名称
	Description string           `json:"description"`                                   // 描述
	Type        DeploymentType   `json:"type" gorm:"not null;index"`                    // 部署类型
	ServerID    uint             `json:"server_id" gorm:"not null;index"`               // 目标服务器
	Status      DeploymentStatus `json:"status" gorm:"default:pending;index"`           // 状态

	// 部署资源引用（根据 Type 使用不同字段）
	NginxConfigID *uint `json:"nginx_config_id,omitempty" gorm:"index"`  // Nginx 配置 ID
	PackageID     *uint `json:"package_id,omitempty" gorm:"index"`       // 离线包 ID
	CertificateID *uint `json:"certificate_id,omitempty" gorm:"index"`   // 证书 ID

	// 部署配置
	TargetPath     string `json:"target_path"`                             // 目标路径
	BackupEnabled  bool   `json:"backup_enabled" gorm:"default:true"`      // 是否备份
	BackupPath     string `json:"backup_path"`                             // 备份文件路径
	RestartService bool   `json:"restart_service" gorm:"default:false"`    // 是否重启服务
	ServiceName    string `json:"service_name"`                            // 服务名称（用于重启）
	DeployParams   string `json:"deploy_params" gorm:"type:text"`          // 部署参数（JSON格式，用于参数化部署）

	// 执行信息
	StartedAt   *time.Time `json:"started_at"`                            // 开始时间
	CompletedAt *time.Time `json:"completed_at"`                          // 完成时间
	Duration    int        `json:"duration"`                              // 耗时（秒）
	ErrorMsg    string     `json:"error_msg"`                             // 错误信息

	// 回滚信息
	CanRollback    bool   `json:"can_rollback"`                            // 是否可回滚
	RolledBackFrom *uint  `json:"rolled_back_from,omitempty"`              // 从哪个部署回滚而来

	// 关联
	Server       *Server          `json:"server,omitempty" gorm:"foreignKey:ServerID"`
	NginxConfig  *NginxConfig     `json:"nginx_config,omitempty" gorm:"foreignKey:NginxConfigID"`
	Package      *MiddlewarePackage `json:"package,omitempty" gorm:"foreignKey:PackageID"`
	Certificate  *Certificate     `json:"certificate,omitempty" gorm:"foreignKey:CertificateID"`
	Logs         []DeploymentLog  `json:"logs,omitempty" gorm:"foreignKey:DeploymentID"`
	Hooks        []DeploymentHook `json:"hooks,omitempty" gorm:"foreignKey:DeploymentID"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// DeploymentLog 部署日志
type DeploymentLog struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	DeploymentID uint      `json:"deployment_id" gorm:"not null;index"`  // 部署任务 ID
	Step         int       `json:"step"`                                  // 步骤序号
	Action       string    `json:"action"`                                // 动作描述
	Status       string    `json:"status"`                                // 状态: success, failed, skipped
	Output       string    `json:"output" gorm:"type:text"`               // 输出内容
	ErrorMsg     string    `json:"error_msg"`                             // 错误信息
	Duration     int       `json:"duration"`                              // 耗时（毫秒）
	CreatedAt    time.Time `json:"created_at"`
}

// TableName 指定表名
func (Deployment) TableName() string {
	return "deployments"
}

func (DeploymentLog) TableName() string {
	return "deployment_logs"
}
