package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pkg/sftp"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
	"golang.org/x/crypto/ssh"
)

type DeploymentAPI struct {
	cfg *config.Config
}

func NewDeploymentAPI(cfg *config.Config) *DeploymentAPI {
	return &DeploymentAPI{cfg: cfg}
}

// CreateDeploymentRequest 创建部署请求
type CreateDeploymentRequest struct {
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description"`
	Type           string `json:"type" binding:"required,oneof=nginx_config package certificate"`
	ServerID       uint   `json:"server_id" binding:"required"`
	NginxConfigID  *uint  `json:"nginx_config_id"`
	PackageID      *uint  `json:"package_id"`
	CertificateID  *uint  `json:"certificate_id"`
	TargetPath     string `json:"target_path"`
	BackupEnabled  bool   `json:"backup_enabled"`
	RestartService bool   `json:"restart_service"`
	ServiceName    string `json:"service_name"`
	DeployParams   string `json:"deploy_params"` // JSON 格式的部署参数
}

// Create 创建部署任务
func (a *DeploymentAPI) Create(c *gin.Context) {
	var req CreateDeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 验证服务器存在
	var server models.Server
	if err := db.DB.First(&server, req.ServerID).Error; err != nil {
		response.Error(c, http.StatusBadRequest, "服务器不存在")
		return
	}

	// 根据类型验证资源
	deployment := &models.Deployment{
		Name:           req.Name,
		Description:    req.Description,
		Type:           models.DeploymentType(req.Type),
		ServerID:       req.ServerID,
		Status:         models.DeployStatusPending,
		TargetPath:     req.TargetPath,
		BackupEnabled:  req.BackupEnabled,
		RestartService: req.RestartService,
		ServiceName:    req.ServiceName,
		DeployParams:   req.DeployParams,
	}

	switch req.Type {
	case "nginx_config":
		if req.NginxConfigID == nil {
			response.Error(c, http.StatusBadRequest, "请选择 Nginx 配置")
			return
		}
		var cfg models.NginxConfig
		if err := db.DB.First(&cfg, *req.NginxConfigID).Error; err != nil {
			response.Error(c, http.StatusBadRequest, "Nginx 配置不存在")
			return
		}
		deployment.NginxConfigID = req.NginxConfigID
		if deployment.TargetPath == "" {
			deployment.TargetPath = "/etc/nginx/nginx.conf"
		}
		if deployment.ServiceName == "" {
			deployment.ServiceName = "nginx"
		}

	case "package":
		if req.PackageID == nil {
			response.Error(c, http.StatusBadRequest, "请选择离线包")
			return
		}
		var pkg models.MiddlewarePackage
		if err := db.DB.First(&pkg, *req.PackageID).Error; err != nil {
			response.Error(c, http.StatusBadRequest, "离线包不存在")
			return
		}
		deployment.PackageID = req.PackageID
		if deployment.TargetPath == "" {
			deployment.TargetPath = "/tmp"
		}

	case "certificate":
		if req.CertificateID == nil {
			response.Error(c, http.StatusBadRequest, "请选择证书")
			return
		}
		var cert models.Certificate
		if err := db.DB.First(&cert, *req.CertificateID).Error; err != nil {
			response.Error(c, http.StatusBadRequest, "证书不存在")
			return
		}
		deployment.CertificateID = req.CertificateID
		if deployment.TargetPath == "" {
			deployment.TargetPath = "/etc/nginx/ssl"
		}
	}

	if err := db.DB.Create(deployment).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "创建部署任务失败")
		return
	}

	response.Success(c, deployment)
}

// List 获取部署任务列表
func (a *DeploymentAPI) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")
	deployType := c.Query("type")

	var deployments []models.Deployment
	var total int64

	query := db.DB.Model(&models.Deployment{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if deployType != "" {
		query = query.Where("type = ?", deployType)
	}

	query.Count(&total)
	query.Preload("Server").Preload("NginxConfig").Preload("Package").Preload("Certificate").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&deployments)

	response.Success(c, gin.H{
		"deployments": deployments,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
	})
}

// Get 获取部署任务详情
func (a *DeploymentAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var deployment models.Deployment
	if err := db.DB.Preload("Server").Preload("NginxConfig").Preload("Package").
		Preload("Certificate").Preload("Logs").First(&deployment, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "部署任务不存在")
		return
	}

	response.Success(c, deployment)
}

// Delete 删除部署任务
func (a *DeploymentAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var deployment models.Deployment
	if err := db.DB.First(&deployment, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "部署任务不存在")
		return
	}

	// 不能删除正在执行的任务
	if deployment.Status == models.DeployStatusRunning {
		response.Error(c, http.StatusBadRequest, "不能删除正在执行的任务")
		return
	}

	// 删除关联日志
	db.DB.Where("deployment_id = ?", id).Delete(&models.DeploymentLog{})
	db.DB.Delete(&deployment)

	response.Success(c, nil)
}

// Execute 执行部署任务
func (a *DeploymentAPI) Execute(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var deployment models.Deployment
	if err := db.DB.Preload("Server").Preload("NginxConfig").Preload("Package").
		Preload("Certificate").First(&deployment, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "部署任务不存在")
		return
	}

	// 检查状态
	if deployment.Status == models.DeployStatusRunning {
		response.Error(c, http.StatusBadRequest, "任务正在执行中")
		return
	}

	// 异步执行部署
	go a.executeDeployment(&deployment)

	response.Success(c, gin.H{"message": "部署任务已开始执行"})
}

// BatchCreateRequest 批量创建部署请求
type BatchCreateRequest struct {
	Name           string   `json:"name" binding:"required"`
	Description    string   `json:"description"`
	Type           string   `json:"type" binding:"required,oneof=nginx_config package certificate"`
	ServerIDs      []uint   `json:"server_ids" binding:"required,min=1"` // 多个服务器ID
	NginxConfigID  *uint    `json:"nginx_config_id"`
	PackageID      *uint    `json:"package_id"`
	CertificateID  *uint    `json:"certificate_id"`
	TargetPath     string   `json:"target_path"`
	BackupEnabled  bool     `json:"backup_enabled"`
	RestartService bool     `json:"restart_service"`
	ServiceName    string   `json:"service_name"`
	DeployParams   string   `json:"deploy_params"` // JSON 格式的部署参数
	AutoExecute    bool     `json:"auto_execute"`  // 是否自动执行
}

// BatchCreate 批量创建部署任务
func (a *DeploymentAPI) BatchCreate(c *gin.Context) {
	var req BatchCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误: "+err.Error())
		return
	}

	// 验证服务器存在
	var servers []models.Server
	if err := db.DB.Where("id IN ?", req.ServerIDs).Find(&servers).Error; err != nil || len(servers) != len(req.ServerIDs) {
		response.Error(c, http.StatusBadRequest, "部分服务器不存在")
		return
	}

	// 根据类型验证资源
	var createdDeployments []models.Deployment

	for _, serverID := range req.ServerIDs {
		deployment := models.Deployment{
			Name:           fmt.Sprintf("%s - %s", req.Name, getServerName(servers, serverID)),
			Description:    req.Description,
			Type:           models.DeploymentType(req.Type),
			ServerID:       serverID,
			Status:         models.DeployStatusPending,
			TargetPath:     req.TargetPath,
			BackupEnabled:  req.BackupEnabled,
			RestartService: req.RestartService,
			ServiceName:    req.ServiceName,
			DeployParams:   req.DeployParams,
		}

		switch req.Type {
		case "nginx_config":
			if req.NginxConfigID == nil {
				response.Error(c, http.StatusBadRequest, "请选择 Nginx 配置")
				return
			}
			deployment.NginxConfigID = req.NginxConfigID
			if deployment.TargetPath == "" {
				deployment.TargetPath = "/etc/nginx/nginx.conf"
			}
			if deployment.ServiceName == "" {
				deployment.ServiceName = "nginx"
			}

		case "package":
			if req.PackageID == nil {
				response.Error(c, http.StatusBadRequest, "请选择离线包")
				return
			}
			deployment.PackageID = req.PackageID
			if deployment.TargetPath == "" {
				deployment.TargetPath = "/tmp"
			}

		case "certificate":
			if req.CertificateID == nil {
				response.Error(c, http.StatusBadRequest, "请选择证书")
				return
			}
			deployment.CertificateID = req.CertificateID
			if deployment.TargetPath == "" {
				deployment.TargetPath = "/etc/nginx/ssl"
			}
		}

		if err := db.DB.Create(&deployment).Error; err != nil {
			response.Error(c, http.StatusInternalServerError, "创建部署任务失败")
			return
		}

		createdDeployments = append(createdDeployments, deployment)

		// 如果设置了自动执行，则立即执行
		if req.AutoExecute {
			go a.executeDeployment(&deployment)
		}
	}

	response.Success(c, gin.H{
		"message":     fmt.Sprintf("成功创建 %d 个部署任务", len(createdDeployments)),
		"deployments": createdDeployments,
	})
}

// getServerName 获取服务器名称
func getServerName(servers []models.Server, serverID uint) string {
	for _, s := range servers {
		if s.ID == serverID {
			return s.Name
		}
	}
	return fmt.Sprintf("Server-%d", serverID)
}

// GetLogs 获取部署日志
func (a *DeploymentAPI) GetLogs(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var logs []models.DeploymentLog
	db.DB.Where("deployment_id = ?", id).Order("step ASC").Find(&logs)

	response.Success(c, logs)
}

// executeDeployment 执行部署（异步）
func (a *DeploymentAPI) executeDeployment(deployment *models.Deployment) {
	startTime := time.Now()

	// 更新状态为执行中
	db.DB.Model(deployment).Updates(map[string]interface{}{
		"status":     models.DeployStatusRunning,
		"started_at": startTime,
		"error_msg":  "",
	})

	// 清除旧日志
	db.DB.Where("deployment_id = ?", deployment.ID).Delete(&models.DeploymentLog{})

	step := 1
	var finalErr error

	defer func() {
		completedAt := time.Now()
		duration := int(completedAt.Sub(startTime).Seconds())

		status := models.DeployStatusSuccess
		errorMsg := ""
		canRollback := false
		if finalErr != nil {
			status = models.DeployStatusFailed
			errorMsg = finalErr.Error()
		} else {
			// 部署成功且有备份的情况下可以回滚
			canRollback = deployment.BackupEnabled && deployment.BackupPath != ""
		}

		db.DB.Model(deployment).Updates(map[string]interface{}{
			"status":       status,
			"completed_at": completedAt,
			"duration":     duration,
			"error_msg":    errorMsg,
			"can_rollback": canRollback,
		})
	}()

	// 1. 建立 SSH 连接
	a.addLog(deployment.ID, step, "建立 SSH 连接", "")
	client, err := a.connectSSH(deployment.Server)
	if err != nil {
		finalErr = fmt.Errorf("SSH 连接失败: %v", err)
		a.updateLog(deployment.ID, step, "failed", "", finalErr.Error())
		return
	}
	defer client.Close()
	a.updateLog(deployment.ID, step, "success", "连接成功", "")
	step++

	// 2. 创建 SFTP 客户端
	a.addLog(deployment.ID, step, "创建 SFTP 会话", "")
	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		finalErr = fmt.Errorf("SFTP 会话创建失败: %v", err)
		a.updateLog(deployment.ID, step, "failed", "", finalErr.Error())
		return
	}
	defer sftpClient.Close()
	a.updateLog(deployment.ID, step, "success", "SFTP 会话已建立", "")
	step++

	// 3. 执行 pre_deploy 钩子
	if err := executeHooksByType(deployment, "pre_deploy", client, sftpClient); err != nil {
		finalErr = fmt.Errorf("pre_deploy 钩子执行失败: %v", err)
		return
	}

	// 4. 根据类型执行部署
	switch deployment.Type {
	case models.DeployTypeNginxConfig:
		finalErr = a.deployNginxConfig(client, sftpClient, deployment, &step)
	case models.DeployTypePackage:
		finalErr = a.deployPackage(client, sftpClient, deployment, &step)
	case models.DeployTypeCertificate:
		finalErr = a.deployCertificate(client, sftpClient, deployment, &step)
	}

	// 5. 执行 post_deploy 钩子（无论成功或失败都执行）
	executeHooksByType(deployment, "post_deploy", client, sftpClient)

	// 6. 根据结果执行 on_success 或 on_failure 钩子
	if finalErr != nil {
		executeHooksByType(deployment, "on_failure", client, sftpClient)
	} else {
		executeHooksByType(deployment, "on_success", client, sftpClient)
	}
}

// deployNginxConfig 部署 Nginx 配置
func (a *DeploymentAPI) deployNginxConfig(client *ssh.Client, sftpClient *sftp.Client, deployment *models.Deployment, step *int) error {
	// 生成配置内容
	a.addLog(deployment.ID, *step, "生成 Nginx 配置", "")
	content, err := generateNginxConfig(deployment.NginxConfig)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", "", err.Error())
		return err
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("配置文件大小: %d 字节", len(content)), "")
	(*step)++

	// 备份原配置
	var backupPath string
	if deployment.BackupEnabled {
		a.addLog(deployment.ID, *step, "备份原配置", "")
		timestamp := time.Now().Format("20060102150405")
		backupPath = fmt.Sprintf("%s.bak.%s", deployment.TargetPath, timestamp)
		backupCmd := fmt.Sprintf("if [ -f %s ]; then cp %s %s; echo '%s'; fi",
			deployment.TargetPath, deployment.TargetPath, backupPath, backupPath)
		output, err := a.runCommand(client, backupCmd)
		if err != nil {
			a.updateLog(deployment.ID, *step, "failed", output, err.Error())
			return fmt.Errorf("备份失败: %v", err)
		}

		// 更新备份路径到数据库
		if strings.TrimSpace(output) != "" {
			db.DB.Model(deployment).Update("backup_path", backupPath)
		}

		a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("备份至: %s", backupPath), "")
		(*step)++
	}

	// 上传配置文件
	a.addLog(deployment.ID, *step, "上传配置文件", "")
	if err := a.uploadContent(sftpClient, deployment.TargetPath, []byte(content)); err != nil {
		a.updateLog(deployment.ID, *step, "failed", "", err.Error())
		return fmt.Errorf("上传失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("已上传至 %s", deployment.TargetPath), "")
	(*step)++

	// 测试配置
	a.addLog(deployment.ID, *step, "测试 Nginx 配置", "")
	output, err := a.runCommand(client, "nginx -t 2>&1")
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("配置测试失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", output, "")
	(*step)++

	// 重启服务
	if deployment.RestartService && deployment.ServiceName != "" {
		a.addLog(deployment.ID, *step, "重启服务", "")
		reloadCmd := fmt.Sprintf("systemctl reload %s 2>&1 || systemctl restart %s 2>&1",
			deployment.ServiceName, deployment.ServiceName)
		output, err := a.runCommand(client, reloadCmd)
		if err != nil {
			a.updateLog(deployment.ID, *step, "failed", output, err.Error())
			return fmt.Errorf("服务重启失败: %v", err)
		}
		a.updateLog(deployment.ID, *step, "success", output, "")
		(*step)++
	}

	return nil
}

// deployPackage 部署离线包
func (a *DeploymentAPI) deployPackage(client *ssh.Client, sftpClient *sftp.Client, deployment *models.Deployment, step *int) error {
	pkg := deployment.Package

	// 创建目标目录
	a.addLog(deployment.ID, *step, "创建目标目录", "")
	mkdirCmd := fmt.Sprintf("mkdir -p %s", deployment.TargetPath)
	output, err := a.runCommand(client, mkdirCmd)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("创建目录失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("目录: %s", deployment.TargetPath), "")
	(*step)++

	// 上传离线包
	a.addLog(deployment.ID, *step, "上传离线包", "")
	localPath := pkg.FilePath
	remotePath := filepath.Join(deployment.TargetPath, pkg.FileName)

	if err := a.uploadFile(sftpClient, localPath, remotePath); err != nil {
		a.updateLog(deployment.ID, *step, "failed", "", err.Error())
		return fmt.Errorf("上传失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("已上传 %s (%.2f MB)", pkg.FileName, float64(pkg.FileSize)/1024/1024), "")
	(*step)++

	// 解压离线包（如果是 tar.gz 或 zip）
	var extractDir string
	if strings.HasSuffix(pkg.FileName, ".tar.gz") || strings.HasSuffix(pkg.FileName, ".tgz") {
		a.addLog(deployment.ID, *step, "解压离线包", "")
		extractCmd := fmt.Sprintf("cd %s && tar -xzf %s", deployment.TargetPath, pkg.FileName)
		output, err := a.runCommand(client, extractCmd)
		if err != nil {
			a.updateLog(deployment.ID, *step, "failed", output, err.Error())
			return fmt.Errorf("解压失败: %v", err)
		}
		a.updateLog(deployment.ID, *step, "success", "解压完成", "")
		(*step)++
		// 通常解压到同名目录（不带扩展名）
		extractDir = strings.TrimSuffix(strings.TrimSuffix(pkg.FileName, ".tar.gz"), ".tgz")
	} else if strings.HasSuffix(pkg.FileName, ".zip") {
		a.addLog(deployment.ID, *step, "解压离线包", "")
		extractCmd := fmt.Sprintf("cd %s && unzip -o %s", deployment.TargetPath, pkg.FileName)
		output, err := a.runCommand(client, extractCmd)
		if err != nil {
			a.updateLog(deployment.ID, *step, "failed", output, err.Error())
			return fmt.Errorf("解压失败: %v", err)
		}
		a.updateLog(deployment.ID, *step, "success", "解压完成", "")
		(*step)++
		// zip 包可能直接解压到当前目录
		extractDir = ""
	}

	// 查找并执行安装脚本
	a.addLog(deployment.ID, *step, "查找安装脚本", "")
	// 查找 .sh 脚本文件
	findScriptCmd := fmt.Sprintf("find %s -name '*.sh' -type f | head -1", deployment.TargetPath)
	if extractDir != "" {
		findScriptCmd = fmt.Sprintf("find %s/%s -name '*.sh' -type f | head -1", deployment.TargetPath, extractDir)
	}

	scriptPath, err := a.runCommand(client, findScriptCmd)
	scriptPath = strings.TrimSpace(scriptPath)

	if err != nil || scriptPath == "" {
		a.updateLog(deployment.ID, *step, "skipped", "未找到安装脚本，跳过执行", "")
		logger.Warnf("未找到安装脚本: %v", err)
		(*step)++
		return nil
	}

	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("找到脚本: %s", scriptPath), "")
	(*step)++

	// 设置脚本执行权限
	a.addLog(deployment.ID, *step, "设置执行权限", "")
	chmodCmd := fmt.Sprintf("chmod +x %s", scriptPath)
	output, err = a.runCommand(client, chmodCmd)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("设置权限失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", "权限设置完成", "")
	(*step)++

	// 构建环境变量并执行脚本
	a.addLog(deployment.ID, *step, "执行安装脚本", "")

	// 解析部署参数
	envVars := ""
	if deployment.DeployParams != "" {
		var params map[string]interface{}
		if err := json.Unmarshal([]byte(deployment.DeployParams), &params); err == nil {
			// 将参数转换为环境变量格式
			for key, value := range params {
				envVars += fmt.Sprintf("export %s='%v'; ", key, value)
			}
		} else {
			logger.Warnf("解析部署参数失败: %v", err)
		}
	}

	// 执行脚本（注入环境变量）
	executeCmd := fmt.Sprintf("cd %s && %s bash %s 2>&1",
		filepath.Dir(scriptPath),
		envVars,
		scriptPath)

	output, err = a.runCommand(client, executeCmd)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("脚本执行失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", output, "")
	(*step)++

	return nil
}

// deployCertificate 部署证书
func (a *DeploymentAPI) deployCertificate(client *ssh.Client, sftpClient *sftp.Client, deployment *models.Deployment, step *int) error {
	cert := deployment.Certificate

	// 创建目标目录
	a.addLog(deployment.ID, *step, "创建证书目录", "")
	mkdirCmd := fmt.Sprintf("mkdir -p %s", deployment.TargetPath)
	output, err := a.runCommand(client, mkdirCmd)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("创建目录失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("目录: %s", deployment.TargetPath), "")
	(*step)++

	// 上传证书文件
	a.addLog(deployment.ID, *step, "上传证书文件", "")
	certRemotePath := filepath.Join(deployment.TargetPath, filepath.Base(cert.CertFilePath))
	if err := a.uploadFile(sftpClient, cert.CertFilePath, certRemotePath); err != nil {
		a.updateLog(deployment.ID, *step, "failed", "", err.Error())
		return fmt.Errorf("上传证书失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("证书已上传至 %s", certRemotePath), "")
	(*step)++

	// 上传私钥文件
	a.addLog(deployment.ID, *step, "上传私钥文件", "")
	keyRemotePath := filepath.Join(deployment.TargetPath, filepath.Base(cert.KeyFilePath))
	if err := a.uploadFile(sftpClient, cert.KeyFilePath, keyRemotePath); err != nil {
		a.updateLog(deployment.ID, *step, "failed", "", err.Error())
		return fmt.Errorf("上传私钥失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", fmt.Sprintf("私钥已上传至 %s", keyRemotePath), "")
	(*step)++

	// 设置权限
	a.addLog(deployment.ID, *step, "设置文件权限", "")
	chmodCmd := fmt.Sprintf("chmod 644 %s && chmod 600 %s", certRemotePath, keyRemotePath)
	output, err = a.runCommand(client, chmodCmd)
	if err != nil {
		a.updateLog(deployment.ID, *step, "failed", output, err.Error())
		return fmt.Errorf("设置权限失败: %v", err)
	}
	a.updateLog(deployment.ID, *step, "success", "权限设置完成", "")
	(*step)++

	// 重启服务
	if deployment.RestartService && deployment.ServiceName != "" {
		a.addLog(deployment.ID, *step, "重启服务", "")
		reloadCmd := fmt.Sprintf("systemctl reload %s 2>&1 || systemctl restart %s 2>&1",
			deployment.ServiceName, deployment.ServiceName)
		output, err := a.runCommand(client, reloadCmd)
		if err != nil {
			a.updateLog(deployment.ID, *step, "failed", output, err.Error())
			return fmt.Errorf("服务重启失败: %v", err)
		}
		a.updateLog(deployment.ID, *step, "success", output, "")
		(*step)++
	}

	return nil
}

// connectSSH 建立 SSH 连接
func (a *DeploymentAPI) connectSSH(server *models.Server) (*ssh.Client, error) {
	var authMethods []ssh.AuthMethod

	if server.AuthType == "password" {
		authMethods = append(authMethods, ssh.Password(server.Password))
	} else if server.AuthType == "key" {
		var signer ssh.Signer
		var err error

		if server.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(server.PrivateKey), []byte(server.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(server.PrivateKey))
		}
		if err != nil {
			return nil, fmt.Errorf("解析私钥失败: %v", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	config := &ssh.ClientConfig{
		User:            server.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", server.Host, server.Port)
	return ssh.Dial("tcp", addr, config)
}

// runCommand 执行远程命令
func (a *DeploymentAPI) runCommand(client *ssh.Client, cmd string) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	return string(output), err
}

// uploadContent 上传内容到远程文件
func (a *DeploymentAPI) uploadContent(sftpClient *sftp.Client, remotePath string, content []byte) error {
	// 确保目录存在
	dir := filepath.Dir(remotePath)
	if err := sftpClient.MkdirAll(dir); err != nil {
		logger.Warnf("创建目录 %s 失败（可能已存在）: %v", dir, err)
	}

	file, err := sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(content)
	return err
}

// uploadFile 上传本地文件到远程
func (a *DeploymentAPI) uploadFile(sftpClient *sftp.Client, localPath, remotePath string) error {
	// 确保目录存在
	dir := filepath.Dir(remotePath)
	if err := sftpClient.MkdirAll(dir); err != nil {
		logger.Warnf("创建目录 %s 失败（可能已存在）: %v", dir, err)
	}

	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("打开本地文件失败: %v", err)
	}
	defer localFile.Close()

	remoteFile, err := sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("创建远程文件失败: %v", err)
	}
	defer remoteFile.Close()

	_, err = io.Copy(remoteFile, localFile)
	if err != nil {
		return fmt.Errorf("复制文件失败: %v", err)
	}

	return nil
}

// addLog 添加日志
func (a *DeploymentAPI) addLog(deploymentID uint, step int, action, output string) {
	log := &models.DeploymentLog{
		DeploymentID: deploymentID,
		Step:         step,
		Action:       action,
		Status:       "running",
		Output:       output,
	}
	db.DB.Create(log)
}

// updateLog 更新日志
func (a *DeploymentAPI) updateLog(deploymentID uint, step int, status, output, errorMsg string) {
	db.DB.Model(&models.DeploymentLog{}).
		Where("deployment_id = ? AND step = ?", deploymentID, step).
		Updates(map[string]interface{}{
			"status":    status,
			"output":    output,
			"error_msg": errorMsg,
		})
}

// Rollback 回滚部署
func (a *DeploymentAPI) Rollback(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var deployment models.Deployment
	if err := db.DB.Preload("Server").First(&deployment, id).Error; err != nil {
		response.Error(c, http.StatusNotFound, "部署任务不存在")
		return
	}

	// 检查是否可以回滚
	if !deployment.CanRollback {
		response.Error(c, http.StatusBadRequest, "该部署不支持回滚")
		return
	}

	if deployment.BackupPath == "" {
		response.Error(c, http.StatusBadRequest, "没有可用的备份文件")
		return
	}

	// 创建新的回滚部署任务
	rollbackDeployment := &models.Deployment{
		Name:           fmt.Sprintf("回滚: %s", deployment.Name),
		Description:    fmt.Sprintf("从部署 #%d 回滚", deployment.ID),
		Type:           deployment.Type,
		ServerID:       deployment.ServerID,
		Status:         models.DeployStatusPending,
		NginxConfigID:  deployment.NginxConfigID,
		PackageID:      deployment.PackageID,
		CertificateID:  deployment.CertificateID,
		TargetPath:     deployment.TargetPath,
		BackupEnabled:  false, // 回滚时不再备份
		RestartService: deployment.RestartService,
		ServiceName:    deployment.ServiceName,
		RolledBackFrom: &deployment.ID,
	}

	if err := db.DB.Create(rollbackDeployment).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "创建回滚任务失败")
		return
	}

	// 异步执行回滚
	go a.executeRollback(rollbackDeployment, &deployment)

	response.Success(c, gin.H{
		"message":    "回滚任务已开始执行",
		"deployment": rollbackDeployment,
	})
}

// executeRollback 执行回滚（异步）
func (a *DeploymentAPI) executeRollback(rollbackDeployment, originalDeployment *models.Deployment) {
	startTime := time.Now()

	// 更新状态为执行中
	db.DB.Model(rollbackDeployment).Updates(map[string]interface{}{
		"status":     models.DeployStatusRunning,
		"started_at": startTime,
		"error_msg":  "",
	})

	// 清除旧日志
	db.DB.Where("deployment_id = ?", rollbackDeployment.ID).Delete(&models.DeploymentLog{})

	step := 1
	var finalErr error

	defer func() {
		completedAt := time.Now()
		duration := int(completedAt.Sub(startTime).Seconds())

		status := models.DeployStatusSuccess
		errorMsg := ""
		if finalErr != nil {
			status = models.DeployStatusFailed
			errorMsg = finalErr.Error()
		}

		db.DB.Model(rollbackDeployment).Updates(map[string]interface{}{
			"status":       status,
			"completed_at": completedAt,
			"duration":     duration,
			"error_msg":    errorMsg,
		})
	}()

	// 1. 建立 SSH 连接
	a.addLog(rollbackDeployment.ID, step, "建立 SSH 连接", "")
	client, err := a.connectSSH(originalDeployment.Server)
	if err != nil {
		finalErr = fmt.Errorf("SSH 连接失败: %v", err)
		a.updateLog(rollbackDeployment.ID, step, "failed", "", finalErr.Error())
		return
	}
	defer client.Close()
	a.updateLog(rollbackDeployment.ID, step, "success", "连接成功", "")
	step++

	// 2. 创建 SFTP 客户端
	a.addLog(rollbackDeployment.ID, step, "创建 SFTP 会话", "")
	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		finalErr = fmt.Errorf("SFTP 会话创建失败: %v", err)
		a.updateLog(rollbackDeployment.ID, step, "failed", "", finalErr.Error())
		return
	}
	defer sftpClient.Close()
	a.updateLog(rollbackDeployment.ID, step, "success", "SFTP 会话已建立", "")
	step++

	// 3. 检查备份文件是否存在
	a.addLog(rollbackDeployment.ID, step, "检查备份文件", "")
	checkCmd := fmt.Sprintf("[ -f %s ] && echo 'exists' || echo 'not_found'", originalDeployment.BackupPath)
	output, err := a.runCommand(client, checkCmd)
	if err != nil || strings.TrimSpace(output) != "exists" {
		finalErr = fmt.Errorf("备份文件不存在: %s", originalDeployment.BackupPath)
		a.updateLog(rollbackDeployment.ID, step, "failed", output, finalErr.Error())
		return
	}
	a.updateLog(rollbackDeployment.ID, step, "success", fmt.Sprintf("备份文件: %s", originalDeployment.BackupPath), "")
	step++

	// 4. 恢复备份文件
	a.addLog(rollbackDeployment.ID, step, "恢复备份文件", "")
	restoreCmd := fmt.Sprintf("cp %s %s", originalDeployment.BackupPath, rollbackDeployment.TargetPath)
	output, err = a.runCommand(client, restoreCmd)
	if err != nil {
		finalErr = fmt.Errorf("恢复失败: %v", err)
		a.updateLog(rollbackDeployment.ID, step, "failed", output, finalErr.Error())
		return
	}
	a.updateLog(rollbackDeployment.ID, step, "success", fmt.Sprintf("已恢复至 %s", rollbackDeployment.TargetPath), "")
	step++

	// 5. 如果是 Nginx 配置，测试配置
	if rollbackDeployment.Type == models.DeployTypeNginxConfig {
		a.addLog(rollbackDeployment.ID, step, "测试 Nginx 配置", "")
		output, err := a.runCommand(client, "nginx -t 2>&1")
		if err != nil {
			a.updateLog(rollbackDeployment.ID, step, "failed", output, err.Error())
			finalErr = fmt.Errorf("配置测试失败: %v", err)
			return
		}
		a.updateLog(rollbackDeployment.ID, step, "success", output, "")
		step++
	}

	// 6. 重启服务
	if rollbackDeployment.RestartService && rollbackDeployment.ServiceName != "" {
		a.addLog(rollbackDeployment.ID, step, "重启服务", "")
		reloadCmd := fmt.Sprintf("systemctl reload %s 2>&1 || systemctl restart %s 2>&1",
			rollbackDeployment.ServiceName, rollbackDeployment.ServiceName)
		output, err := a.runCommand(client, reloadCmd)
		if err != nil {
			a.updateLog(rollbackDeployment.ID, step, "failed", output, err.Error())
			finalErr = fmt.Errorf("服务重启失败: %v", err)
			return
		}
		a.updateLog(rollbackDeployment.ID, step, "success", output, "")
		step++
	}
}
