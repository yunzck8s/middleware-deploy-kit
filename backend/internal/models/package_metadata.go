package models

// PackageMetadata 离线包元数据
type PackageMetadata struct {
	Name        string      `json:"name"`                   // 包名称
	Version     string      `json:"version"`                // 版本号
	DisplayName string      `json:"display_name"`           // 显示名称
	Description string      `json:"description"`            // 描述
	SupportedOS []string    `json:"supported_os"`           // 支持的操作系统
	InstallScript string    `json:"install_script"`         // 安装脚本名称
	Parameters  []Parameter `json:"parameters"`             // 可配置参数列表
	Features    []string    `json:"features,omitempty"`     // 功能特性
	Requirements Requirements `json:"requirements,omitempty"` // 系统要求
}

// Parameter 可配置参数
type Parameter struct {
	Name         string      `json:"name"`                    // 参数名（环境变量名）
	Label        string      `json:"label"`                   // 显示标签
	Type         string      `json:"type"`                    // 类型: string, number, boolean, select
	Default      interface{} `json:"default,omitempty"`       // 默认值
	Required     bool        `json:"required,omitempty"`      // 是否必填
	Description  string      `json:"description,omitempty"`   // 参数说明
	Placeholder  string      `json:"placeholder,omitempty"`   // 占位符
	Options      []Option    `json:"options,omitempty"`       // 选项（type=select时使用）
	Validation   *Validation `json:"validation,omitempty"`    // 验证规则
}

// Option 选择项
type Option struct {
	Label string      `json:"label"` // 显示文本
	Value interface{} `json:"value"` // 值
}

// Validation 验证规则
type Validation struct {
	Min     *int64  `json:"min,omitempty"`     // 最小值（数字）
	Max     *int64  `json:"max,omitempty"`     // 最大值（数字）
	MinLen  *int    `json:"min_len,omitempty"` // 最小长度（字符串）
	MaxLen  *int    `json:"max_len,omitempty"` // 最大长度（字符串）
	Pattern *string `json:"pattern,omitempty"` // 正则表达式
	Message string  `json:"message,omitempty"` // 错误提示信息
}

// Requirements 系统要求
type Requirements struct {
	MinMemory string   `json:"min_memory,omitempty"` // 最小内存（如 "512MB", "1GB"）
	MinDisk   string   `json:"min_disk,omitempty"`   // 最小磁盘（如 "100MB"）
	Ports     []int    `json:"ports,omitempty"`      // 需要的端口列表
	Dependencies []string `json:"dependencies,omitempty"` // 依赖的系统包
}
