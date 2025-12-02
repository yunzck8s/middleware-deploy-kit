package models

import (
	"time"

	"gorm.io/gorm"
)

// NginxConfigApply Nginx 配置应用记录
type NginxConfigApply struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	NginxConfigID uint   `json:"nginx_config_id" gorm:"not null;index"`
	ServerID      uint   `json:"server_id" gorm:"not null;index"`

	// 部署配置
	TargetPath     string `json:"target_path" gorm:"default:'/etc/nginx/nginx.conf'"` // 目标路径
	BackupEnabled  bool   `json:"backup_enabled" gorm:"default:true"`                 // 是否备份
	BackupPath     string `json:"backup_path"`                                         // 备份路径
	RestartService bool   `json:"restart_service" gorm:"default:true"`                // 是否重启服务
	ServiceName    string `json:"service_name" gorm:"default:'nginx'"`                // 服务名称

	// 执行状态
	Status      string `json:"status" gorm:"default:'pending';index"` // pending, running, success, failed, cancelled
	StartTime   *time.Time `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	Duration    int    `json:"duration"` // 执行耗时（秒）
	ErrorMsg    string `json:"error_msg" gorm:"type:text"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	NginxConfig *NginxConfig `json:"nginx_config,omitempty" gorm:"foreignKey:NginxConfigID"`
	Server      *Server      `json:"server,omitempty" gorm:"foreignKey:ServerID"`
	Logs        []NginxConfigApplyLog `json:"logs,omitempty" gorm:"foreignKey:ApplyID"`
}

// TableName 表名
func (NginxConfigApply) TableName() string {
	return "nginx_config_applies"
}

// NginxConfigApplyLog Nginx 配置应用日志
type NginxConfigApplyLog struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	ApplyID uint   `json:"apply_id" gorm:"not null;index"`
	Step    int    `json:"step"`                          // 步骤序号
	Action  string `json:"action" gorm:"not null"`        // 步骤描述
	Status  string `json:"status" gorm:"default:'pending'"` // pending, running, success, failed
	Output  string `json:"output" gorm:"type:text"`       // 输出内容
	ErrorMsg string `json:"error_msg" gorm:"type:text"`   // 错误信息

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName 表名
func (NginxConfigApplyLog) TableName() string {
	return "nginx_config_apply_logs"
}
