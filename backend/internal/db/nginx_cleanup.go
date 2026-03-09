package db

import (
	"fmt"
	"os"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"gorm.io/gorm"
)

func cleanupLegacyNonNginxData() error {
	var packages []models.MiddlewarePackage
	if err := DB.Where("name <> ?", models.MiddlewareNameNginx).Find(&packages).Error; err != nil {
		return fmt.Errorf("query legacy packages: %w", err)
	}

	if len(packages) == 0 {
		return nil
	}

	packageIDs := make([]uint, 0, len(packages))
	for _, pkg := range packages {
		packageIDs = append(packageIDs, pkg.ID)
	}

	deploymentIDs := make([]uint, 0)
	if err := DB.Transaction(func(tx *gorm.DB) error {
		var deployments []models.Deployment
		if err := tx.Where("package_id IN ?", packageIDs).Find(&deployments).Error; err != nil {
			return err
		}

		if len(deployments) > 0 {
			deploymentIDs = make([]uint, 0, len(deployments))
			for _, deployment := range deployments {
				deploymentIDs = append(deploymentIDs, deployment.ID)
			}

			if err := tx.Where("deployment_id IN ?", deploymentIDs).Delete(&models.DeploymentLog{}).Error; err != nil {
				return err
			}
			if err := tx.Where("deployment_id IN ?", deploymentIDs).Delete(&models.DeploymentHook{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id IN ?", deploymentIDs).Delete(&models.Deployment{}).Error; err != nil {
				return err
			}
		}

		for _, pkg := range packages {
			if pkg.Status == "deleted" {
				continue
			}
			if err := tx.Model(&models.MiddlewarePackage{}).Where("id = ?", pkg.ID).Update("status", "deleted").Error; err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return fmt.Errorf("cleanup legacy nginx data: %w", err)
	}

	for _, pkg := range packages {
		if pkg.FilePath == "" {
			continue
		}
		if err := os.Remove(pkg.FilePath); err != nil {
			if os.IsNotExist(err) {
				logger.Warnf("历史离线包文件不存在，跳过删除: %s", pkg.FilePath)
				continue
			}
			logger.Warnf("删除历史离线包文件失败: %s, err=%v", pkg.FilePath, err)
		}
	}

	logger.Infof("历史非 Nginx 数据清理完成: packages=%d deployments=%d", len(packages), len(deploymentIDs))
	return nil
}
