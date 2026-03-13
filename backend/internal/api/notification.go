package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

type NotificationAPI struct {
	cfg *config.Config
}

func NewNotificationAPI(cfg *config.Config) *NotificationAPI {
	return &NotificationAPI{cfg: cfg}
}

func (api *NotificationAPI) List(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	query := db.DB.Model(&models.Notification{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var notifications []models.Notification
	query.Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&notifications)

	response.Success(c, gin.H{
		"list":  notifications,
		"total": total,
		"page":  page,
	})
}

func (api *NotificationAPI) GetUnreadCount(c *gin.Context) {
	var count int64
	db.DB.Model(&models.Notification{}).Where("status = ?", "unread").Count(&count)
	response.Success(c, gin.H{"count": count})
}

func (api *NotificationAPI) MarkRead(c *gin.Context) {
	id := c.Param("id")
	now := time.Now()
	if err := db.DB.Model(&models.Notification{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": "read", "read_at": now}).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "标记失败")
		return
	}
	response.Success(c, nil)
}

func (api *NotificationAPI) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := db.DB.Delete(&models.Notification{}, id).Error; err != nil {
		response.Error(c, http.StatusInternalServerError, "删除失败")
		return
	}
	response.Success(c, nil)
}
