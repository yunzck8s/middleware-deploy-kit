package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDeploymentTestDB(t *testing.T) *gorm.DB {
	// 初始化 logger
	logger.Init()

	testDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// 自动迁移
	err = testDB.AutoMigrate(
		&models.Server{},
		&models.NginxConfig{},
		&models.MiddlewarePackage{},
		&models.Certificate{},
		&models.Deployment{},
		&models.DeploymentLog{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return testDB
}

func TestDeploymentAPI_Create(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupDeploymentTestDB(t)
	db.DB = testDB

	// 创建测试数据
	server := &models.Server{
		Name:     "test-server",
		Host:     "192.168.1.100",
		Port:     22,
		Username: "root",
		AuthType: "password",
		Password: "password",
	}
	testDB.Create(server)

	nginxConfig := &models.NginxConfig{
		Name:        "test-config",
		Description: "test",
		Status:      "active",
	}
	testDB.Create(nginxConfig)

	cfg := &config.Config{}
	deployAPI := NewDeploymentAPI(cfg)

	router := gin.New()
	router.POST("/deployments", deployAPI.Create)

	tests := []struct {
		name       string
		reqBody    map[string]interface{}
		wantStatus int
		wantError  bool
	}{
		{
			name: "成功创建 Nginx 配置部署",
			reqBody: map[string]interface{}{
				"name":            "测试部署",
				"description":     "测试描述",
				"type":            "nginx_config",
				"server_id":       server.ID,
				"nginx_config_id": nginxConfig.ID,
				"backup_enabled":  true,
				"restart_service": true,
			},
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name: "缺少必填字段",
			reqBody: map[string]interface{}{
				"name": "测试部署",
				"type": "nginx_config",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name: "服务器不存在",
			reqBody: map[string]interface{}{
				"name":            "测试部署",
				"type":            "nginx_config",
				"server_id":       9999,
				"nginx_config_id": nginxConfig.ID,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name: "Nginx 配置不存在",
			reqBody: map[string]interface{}{
				"name":            "测试部署",
				"type":            "nginx_config",
				"server_id":       server.ID,
				"nginx_config_id": 9999,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name: "无效的部署类型",
			reqBody: map[string]interface{}{
				"name":      "测试部署",
				"type":      "invalid_type",
				"server_id": server.ID,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req, _ := http.NewRequest(http.MethodPost, "/deployments", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if !tt.wantError {
				var resp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.Equal(t, float64(200), resp["code"])

				data := resp["data"].(map[string]interface{})
				assert.Equal(t, tt.reqBody["name"], data["name"])
				assert.Equal(t, "pending", data["status"])
			}
		})
	}
}

func TestDeploymentAPI_List(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupDeploymentTestDB(t)
	db.DB = testDB

	// 创建测试数据
	server := &models.Server{Name: "test-server", Host: "192.168.1.100", Port: 22}
	testDB.Create(server)

	deployments := []models.Deployment{
		{
			Name:     "部署1",
			Type:     models.DeployTypeNginxConfig,
			ServerID: server.ID,
			Status:   models.DeployStatusSuccess,
		},
		{
			Name:     "部署2",
			Type:     models.DeployTypePackage,
			ServerID: server.ID,
			Status:   models.DeployStatusFailed,
		},
		{
			Name:     "部署3",
			Type:     models.DeployTypeNginxConfig,
			ServerID: server.ID,
			Status:   models.DeployStatusPending,
		},
	}
	for i := range deployments {
		testDB.Create(&deployments[i])
	}

	cfg := &config.Config{}
	deployAPI := NewDeploymentAPI(cfg)

	router := gin.New()
	router.GET("/deployments", deployAPI.List)

	tests := []struct {
		name       string
		queryParam string
		wantCount  int
	}{
		{
			name:       "获取所有部署",
			queryParam: "",
			wantCount:  3,
		},
		{
			name:       "按状态筛选 - success",
			queryParam: "?status=success",
			wantCount:  1,
		},
		{
			name:       "按类型筛选 - nginx_config",
			queryParam: "?type=nginx_config",
			wantCount:  2,
		},
		{
			name:       "分页",
			queryParam: "?page=1&page_size=2",
			wantCount:  2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, "/deployments"+tt.queryParam, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)

			var resp map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &resp)
			assert.NoError(t, err)

			data := resp["data"].(map[string]interface{})
			deployments := data["deployments"].([]interface{})
			assert.Equal(t, tt.wantCount, len(deployments))
		})
	}
}

func TestDeploymentAPI_Get(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupDeploymentTestDB(t)
	db.DB = testDB

	// 创建测试数据
	server := &models.Server{Name: "test-server", Host: "192.168.1.100", Port: 22}
	testDB.Create(server)

	deployment := &models.Deployment{
		Name:        "测试部署",
		Description: "测试描述",
		Type:        models.DeployTypeNginxConfig,
		ServerID:    server.ID,
		Status:      models.DeployStatusSuccess,
	}
	testDB.Create(deployment)

	// 添加日志
	logs := []models.DeploymentLog{
		{DeploymentID: deployment.ID, Step: 1, Action: "步骤1", Status: "success"},
		{DeploymentID: deployment.ID, Step: 2, Action: "步骤2", Status: "success"},
	}
	for i := range logs {
		testDB.Create(&logs[i])
	}

	cfg := &config.Config{}
	deployAPI := NewDeploymentAPI(cfg)

	router := gin.New()
	router.GET("/deployments/:id", deployAPI.Get)

	tests := []struct {
		name       string
		id         string
		wantStatus int
		checkLogs  bool
	}{
		{
			name:       "获取存在的部署",
			id:         "1",
			wantStatus: http.StatusOK,
			checkLogs:  true,
		},
		{
			name:       "获取不存在的部署",
			id:         "9999",
			wantStatus: http.StatusNotFound,
			checkLogs:  false,
		},
		{
			name:       "无效的ID",
			id:         "invalid",
			wantStatus: http.StatusBadRequest,
			checkLogs:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, "/deployments/"+tt.id, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.checkLogs {
				var resp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)

				data := resp["data"].(map[string]interface{})
				assert.Equal(t, "测试部署", data["name"])

				logs := data["logs"].([]interface{})
				assert.Equal(t, 2, len(logs))
			}
		})
	}
}

func TestDeploymentAPI_Delete(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupDeploymentTestDB(t)
	db.DB = testDB

	// 创建测试数据
	server := &models.Server{Name: "test-server", Host: "192.168.1.100", Port: 22}
	testDB.Create(server)

	pendingDeploy := &models.Deployment{
		Name:     "待执行部署",
		Type:     models.DeployTypeNginxConfig,
		ServerID: server.ID,
		Status:   models.DeployStatusPending,
	}
	testDB.Create(pendingDeploy)

	runningDeploy := &models.Deployment{
		Name:     "执行中部署",
		Type:     models.DeployTypeNginxConfig,
		ServerID: server.ID,
		Status:   models.DeployStatusRunning,
	}
	testDB.Create(runningDeploy)

	cfg := &config.Config{}
	deployAPI := NewDeploymentAPI(cfg)

	router := gin.New()
	router.DELETE("/deployments/:id", deployAPI.Delete)

	tests := []struct {
		name       string
		id         string
		wantStatus int
	}{
		{
			name:       "删除待执行的部署",
			id:         "1",
			wantStatus: http.StatusOK,
		},
		{
			name:       "删除正在执行的部署",
			id:         "2",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "删除不存在的部署",
			id:         "9999",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodDelete, "/deployments/"+tt.id, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)
		})
	}
}
