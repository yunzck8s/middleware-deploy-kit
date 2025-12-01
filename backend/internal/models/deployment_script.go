package models

import (
	"time"
)

// DeploymentScript 部署脚本模板
type DeploymentScript struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255;not null" json:"name"`                   // 脚本名称
	Description string    `gorm:"type:text" json:"description"`                    // 脚本描述
	Category    string    `gorm:"size:50;not null;default:'custom'" json:"category"` // 脚本分类: pre_deploy, post_deploy, custom
	OSType      string    `gorm:"size:50" json:"os_type"`                          // 适用系统类型（空表示通用）
	OSVersion   string    `gorm:"size:50" json:"os_version"`                       // 适用系统版本（空表示通用）

	// 脚本内容
	ScriptType  string    `gorm:"size:20;not null;default:'shell'" json:"script_type"` // 脚本类型: shell, python, bash
	Content     string    `gorm:"type:text;not null" json:"content"`                   // 脚本内容

	// 执行配置
	Timeout     int       `gorm:"default:300" json:"timeout"`                      // 超时时间（秒）
	WorkDir     string    `gorm:"size:500" json:"work_dir"`                        // 工作目录
	Variables   string    `gorm:"type:text" json:"variables"`                      // 变量定义（JSON格式）

	// 状态
	Status      string    `gorm:"size:20;not null;default:'active'" json:"status"` // 状态: active, disabled
	IsTemplate  bool      `gorm:"default:true" json:"is_template"`                 // 是否为模板

	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// DeploymentHook 部署钩子配置
type DeploymentHook struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	DeploymentID uint      `gorm:"not null;index" json:"deployment_id"`             // 关联的部署任务ID
	ScriptID     *uint     `gorm:"index" json:"script_id,omitempty"`                // 关联的脚本模板ID（可选）

	// 钩子配置
	HookType     string    `gorm:"size:20;not null" json:"hook_type"`               // 钩子类型: pre_deploy, post_deploy, on_success, on_failure
	ScriptType   string    `gorm:"size:20;not null;default:'shell'" json:"script_type"` // 脚本类型
	Content      string    `gorm:"type:text;not null" json:"content"`               // 脚本内容

	// 执行配置
	Timeout      int       `gorm:"default:300" json:"timeout"`                      // 超时时间（秒）
	WorkDir      string    `gorm:"size:500" json:"work_dir"`                        // 工作目录
	Variables    string    `gorm:"type:text" json:"variables"`                      // 变量定义（JSON格式）

	// 执行结果
	Executed     bool      `gorm:"default:false" json:"executed"`                   // 是否已执行
	ExecutedAt   *time.Time `json:"executed_at,omitempty"`                          // 执行时间
	Status       string    `gorm:"size:20" json:"status"`                           // 执行状态: success, failed, skipped
	Output       string    `gorm:"type:text" json:"output"`                         // 执行输出
	ErrorMsg     string    `gorm:"type:text" json:"error_msg"`                      // 错误信息
	Duration     int64     `gorm:"default:0" json:"duration"`                       // 执行耗时（毫秒）

	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// 关联
	Script       *DeploymentScript `gorm:"foreignKey:ScriptID" json:"script,omitempty"`
}

// TableName 指定表名
func (DeploymentScript) TableName() string {
	return "deployment_scripts"
}

// TableName 指定表名
func (DeploymentHook) TableName() string {
	return "deployment_hooks"
}
