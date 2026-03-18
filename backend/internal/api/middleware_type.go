package api

import (
	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// MiddlewareTypeStats 中间件类型统计
type MiddlewareTypeStats struct {
	Type         string `json:"type"`
	Count        int64  `json:"count"`
	Configs      int64  `json:"configs,omitempty"`
	Certificates int64  `json:"certificates,omitempty"`
	LastDeploy   string `json:"last_deploy,omitempty"`
}

// GetMiddlewareTypes 获取所有中间件类型及统计
func GetMiddlewareTypes(c *gin.Context) {
	var types []string
	db.DB.Model(&models.MiddlewareInstance{}).Distinct("type").Pluck("type", &types)

	var stats []MiddlewareTypeStats
	for _, t := range types {
		var count int64
		db.DB.Model(&models.MiddlewareInstance{}).Where("type = ?", t).Count(&count)

		stat := MiddlewareTypeStats{
			Type:  t,
			Count: count,
		}

		if t == "nginx" {
			db.DB.Model(&models.NginxConfig{}).
				Joins("JOIN middleware_instances ON nginx_configs.instance_id = middleware_instances.id").
				Where("middleware_instances.type = ?", t).
				Count(&stat.Configs)

			db.DB.Model(&models.Certificate{}).
				Joins("JOIN middleware_instances ON certificates.instance_id = middleware_instances.id").
				Where("middleware_instances.type = ?", t).
				Count(&stat.Certificates)

			var lastDeploy models.Deployment
			if err := db.DB.Joins("JOIN middleware_instances ON deployments.instance_id = middleware_instances.id").
				Where("middleware_instances.type = ?", t).
				Order("deployments.created_at DESC").
				First(&lastDeploy).Error; err == nil {
				stat.LastDeploy = lastDeploy.CreatedAt.Format("2006-01-02 15:04:05")
			}
		}

		stats = append(stats, stat)
	}

	response.Success(c, stats)
}
