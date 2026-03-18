package db

import (
	"fmt"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
)

// MigrateToInstanceModel 迁移现有数据到实例模型
func MigrateToInstanceModel() error {
	// 检查是否已经迁移过
	var instanceCount int64
	if err := DB.Model(&models.MiddlewareInstance{}).Count(&instanceCount).Error; err != nil {
		return fmt.Errorf("failed to count instances: %w", err)
	}

	if instanceCount > 0 {
		logger.Info("实例数据已存在，跳过迁移")
		return nil
	}

	// 从 NginxConfig 和 Deployment 中提取唯一的 ServerID
	var serverIDs []uint
	if err := DB.Model(&models.NginxConfig{}).
		Where("server_id IS NOT NULL").
		Distinct("server_id").
		Pluck("server_id", &serverIDs).Error; err != nil {
		return fmt.Errorf("failed to get server ids from nginx_configs: %w", err)
	}

	// 从 Deployment 中获取更多 ServerID（所有类型）
	var deployServerIDs []uint
	if err := DB.Model(&models.Deployment{}).
		Where("server_id IS NOT NULL").
		Distinct("server_id").
		Pluck("server_id", &deployServerIDs).Error; err != nil {
		return fmt.Errorf("failed to get server ids from deployments: %w", err)
	}

	// 合并去重
	serverIDMap := make(map[uint]bool)
	for _, id := range serverIDs {
		serverIDMap[id] = true
	}
	for _, id := range deployServerIDs {
		serverIDMap[id] = true
	}

	// 为每个 ServerID 创建默认 Nginx 实例
	for serverID := range serverIDMap {
		var server models.Server
		if err := DB.First(&server, serverID).Error; err != nil {
			logger.Warnf("服务器 %d 不存在，跳过", serverID)
			continue
		}

		instance := &models.MiddlewareInstance{
			Name:        fmt.Sprintf("nginx-%s", server.Name),
			Type:        "nginx",
			ServerID:    serverID,
			Version:     "",
			InstallPath: "/usr/local/nginx",
			Status:      "unknown",
			Environment: "prod",
			Description: "自动迁移创建的默认实例",
		}

		if err := DB.Create(instance).Error; err != nil {
			logger.Errorf("创建实例失败: %v", err)
			continue
		}

		// 更新该服务器的所有 NginxConfig
		if err := DB.Model(&models.NginxConfig{}).
			Where("server_id = ?", serverID).
			Update("instance_id", instance.ID).Error; err != nil {
			logger.Errorf("更新 NginxConfig 失败: %v", err)
		}

		// 更新该服务器的所有 Certificate（通过 NginxConfig 关联）
		var certIDs []uint
		DB.Model(&models.NginxConfig{}).
			Where("server_id = ? AND certificate_id IS NOT NULL", serverID).
			Distinct("certificate_id").
			Pluck("certificate_id", &certIDs)
		if len(certIDs) > 0 {
			if err := DB.Model(&models.Certificate{}).
				Where("id IN ?", certIDs).
				Update("instance_id", instance.ID).Error; err != nil {
				logger.Errorf("更新 Certificate 失败: %v", err)
			}
		}

		// 更新该服务器的所有 Deployment（所有类型）
		if err := DB.Model(&models.Deployment{}).
			Where("server_id = ?", serverID).
			Update("instance_id", instance.ID).Error; err != nil {
			logger.Errorf("更新 Deployment 失败: %v", err)
		}

		logger.Infof("为服务器 %s 创建实例: %s", server.Name, instance.Name)
	}

	logger.Info("实例数据迁移完成")
	return nil
}
