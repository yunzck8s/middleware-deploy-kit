package api

import (
	"fmt"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"golang.org/x/crypto/ssh"
)

// executeHook 执行单个钩子
func executeHook(hook *models.DeploymentHook, sshClient *ssh.Client, sftpClient *sftp.Client) error {
	startTime := time.Now()
	hook.Executed = true
	now := time.Now()
	hook.ExecutedAt = &now

	defer func() {
		hook.Duration = time.Since(startTime).Milliseconds()
		db.DB.Save(hook)
	}()

	logger.Infof("执行钩子: %s (类型: %s)", hook.HookType, hook.ScriptType)

	// 准备工作目录
	workDir := hook.WorkDir
	if workDir == "" {
		workDir = "/tmp"
	}

	// 生成脚本文件名
	scriptFileName := fmt.Sprintf("hook_%d_%s.sh", hook.ID, hook.HookType)
	scriptPath := fmt.Sprintf("%s/%s", workDir, scriptFileName)

	// 上传脚本内容到服务器
	scriptContent := hook.Content

	// 添加 shebang
	if hook.ScriptType == "shell" || hook.ScriptType == "bash" {
		if !strings.HasPrefix(scriptContent, "#!") {
			scriptContent = "#!/bin/bash\nset -e\n\n" + scriptContent
		}
	} else if hook.ScriptType == "python" {
		if !strings.HasPrefix(scriptContent, "#!") {
			scriptContent = "#!/usr/bin/env python3\n\n" + scriptContent
		}
	}

	// 创建远程文件
	remoteFile, err := sftpClient.Create(scriptPath)
	if err != nil {
		hook.Status = "failed"
		hook.ErrorMsg = fmt.Sprintf("创建脚本文件失败: %v", err)
		logger.Errorf(hook.ErrorMsg)
		return fmt.Errorf(hook.ErrorMsg)
	}

	_, err = remoteFile.Write([]byte(scriptContent))
	remoteFile.Close()
	if err != nil {
		hook.Status = "failed"
		hook.ErrorMsg = fmt.Sprintf("写入脚本内容失败: %v", err)
		logger.Errorf(hook.ErrorMsg)
		return fmt.Errorf(hook.ErrorMsg)
	}

	// 设置脚本可执行权限
	if err := sftpClient.Chmod(scriptPath, 0755); err != nil {
		hook.Status = "failed"
		hook.ErrorMsg = fmt.Sprintf("设置脚本权限失败: %v", err)
		logger.Errorf(hook.ErrorMsg)
		return fmt.Errorf(hook.ErrorMsg)
	}

	// 执行脚本
	session, err := sshClient.NewSession()
	if err != nil {
		hook.Status = "failed"
		hook.ErrorMsg = fmt.Sprintf("创建 SSH 会话失败: %v", err)
		logger.Errorf(hook.ErrorMsg)
		return fmt.Errorf(hook.ErrorMsg)
	}
	defer session.Close()

	// 设置超时
	timeout := time.Duration(hook.Timeout) * time.Second
	done := make(chan error, 1)

	var output []byte
	go func() {
		// 切换到工作目录并执行脚本
		cmd := fmt.Sprintf("cd %s && %s", workDir, scriptPath)
		output, err = session.CombinedOutput(cmd)
		done <- err
	}()

	select {
	case err := <-done:
		hook.Output = string(output)

		// 清理脚本文件
		cleanupSession, _ := sshClient.NewSession()
		if cleanupSession != nil {
			cleanupSession.Run(fmt.Sprintf("rm -f %s", scriptPath))
			cleanupSession.Close()
		}

		if err != nil {
			hook.Status = "failed"
			hook.ErrorMsg = fmt.Sprintf("脚本执行失败: %v", err)
			logger.Errorf("钩子执行失败: %s - %v", hook.HookType, err)
			return fmt.Errorf(hook.ErrorMsg)
		}

		hook.Status = "success"
		logger.Infof("钩子执行成功: %s (耗时: %dms)", hook.HookType, hook.Duration)
		return nil

	case <-time.After(timeout):
		hook.Status = "failed"
		hook.ErrorMsg = fmt.Sprintf("脚本执行超时（超过 %d 秒）", hook.Timeout)
		logger.Errorf(hook.ErrorMsg)

		// 尝试清理
		cleanupSession, _ := sshClient.NewSession()
		if cleanupSession != nil {
			cleanupSession.Run(fmt.Sprintf("pkill -f %s; rm -f %s", scriptPath, scriptPath))
			cleanupSession.Close()
		}

		return fmt.Errorf(hook.ErrorMsg)
	}
}

// executeHooksByType 执行指定类型的所有钩子
func executeHooksByType(deployment *models.Deployment, hookType string, sshClient *ssh.Client, sftpClient *sftp.Client) error {
	// 获取该部署的所有钩子
	var hooks []models.DeploymentHook
	if err := db.DB.Where("deployment_id = ? AND hook_type = ?", deployment.ID, hookType).
		Order("id ASC").
		Find(&hooks).Error; err != nil {
		logger.Errorf("获取钩子失败: %v", err)
		return err
	}

	if len(hooks) == 0 {
		logger.Infof("没有找到类型为 %s 的钩子", hookType)
		return nil
	}

	logger.Infof("开始执行 %d 个 %s 钩子", len(hooks), hookType)

	for i := range hooks {
		hook := &hooks[i]

		// 记录日志
		logEntry := &models.DeploymentLog{
			DeploymentID: deployment.ID,
			Step:         0, // 钩子日志不计入常规步骤
			Action:       fmt.Sprintf("执行钩子: %s", hookType),
			Status:       "running",
		}
		db.DB.Create(logEntry)

		// 执行钩子
		err := executeHook(hook, sshClient, sftpClient)

		// 更新日志
		if err != nil {
			logEntry.Status = "failed"
			logEntry.ErrorMsg = hook.ErrorMsg
			logEntry.Output = hook.Output
			db.DB.Save(logEntry)

			// pre_deploy 钩子失败则终止部署
			if hookType == "pre_deploy" {
				return fmt.Errorf("pre_deploy 钩子执行失败，终止部署: %v", err)
			}

			// post_deploy 和其他钩子失败仅记录警告
			logger.Warnf("%s 钩子执行失败: %v", hookType, err)
		} else {
			logEntry.Status = "success"
			logEntry.Output = hook.Output
			db.DB.Save(logEntry)
		}

		logEntry.Duration = int(hook.Duration)
		db.DB.Save(logEntry)
	}

	logger.Infof("完成执行 %s 钩子", hookType)
	return nil
}
