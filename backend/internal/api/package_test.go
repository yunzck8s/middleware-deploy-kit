package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"mime/multipart"
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

func setupPackageTestDB(t *testing.T) (*gorm.DB, *config.Config) {
	logger.Init()

	testDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	if err := testDB.AutoMigrate(&models.MiddlewarePackage{}); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	db.DB = testDB
	cfg := &config.Config{
		Data: config.DataConfig{
			UploadDir: t.TempDir(),
		},
	}

	return testDB, cfg
}

func createPackageZip(t *testing.T, metadata string) []byte {
	t.Helper()

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	metadataFile, err := zipWriter.Create("metadata.json")
	if err != nil {
		t.Fatalf("failed to create metadata file: %v", err)
	}
	if _, err := metadataFile.Write([]byte(metadata)); err != nil {
		t.Fatalf("failed to write metadata: %v", err)
	}

	scriptFile, err := zipWriter.Create("install.sh")
	if err != nil {
		t.Fatalf("failed to create script file: %v", err)
	}
	if _, err := scriptFile.Write([]byte("#!/bin/bash\necho ok\n")); err != nil {
		t.Fatalf("failed to write script: %v", err)
	}

	if err := zipWriter.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	return buf.Bytes()
}

func createUploadRequest(t *testing.T, fields map[string]string, fileName string, fileContent []byte) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("failed to write field: %v", err)
		}
	}

	fileWriter, err := writer.CreateFormFile("file", fileName)
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	if _, err := fileWriter.Write(fileContent); err != nil {
		t.Fatalf("failed to write file content: %v", err)
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, "/packages", &body)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestPackageAPI_Upload(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		fields     map[string]string
		metadata   string
		wantStatus int
		wantCount  int64
	}{
		{
			name: "成功上传 nginx 离线包",
			fields: map[string]string{
				"name":       "nginx",
				"version":    "1.28.0",
				"os_type":    "rocky",
				"os_version": "9.4",
			},
			metadata:   `{"name":"nginx","version":"1.28.0","display_name":"Nginx Web Server","description":"nginx offline package"}`,
			wantStatus: http.StatusOK,
			wantCount:  1,
		},
		{
			name: "拒绝上传非 nginx 名称",
			fields: map[string]string{
				"name":       "redis",
				"version":    "6.2.20",
				"os_type":    "rocky",
				"os_version": "9.4",
			},
			metadata:   `{"name":"redis","version":"6.2.20"}`,
			wantStatus: http.StatusBadRequest,
			wantCount:  0,
		},
		{
			name: "拒绝 metadata 与请求不匹配的包",
			fields: map[string]string{
				"name":       "nginx",
				"version":    "1.28.0",
				"os_type":    "rocky",
				"os_version": "9.4",
			},
			metadata:   `{"name":"redis","version":"6.2.20"}`,
			wantStatus: http.StatusBadRequest,
			wantCount:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testDB, cfg := setupPackageTestDB(t)
			packageAPI := NewPackageAPI(cfg)

			router := gin.New()
			router.POST("/packages", packageAPI.Upload)

			req := createUploadRequest(t, tt.fields, "offline.zip", createPackageZip(t, tt.metadata))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			var count int64
			testDB.Model(&models.MiddlewarePackage{}).Count(&count)
			assert.Equal(t, tt.wantCount, count)
		})
	}
}

func TestPackageAPI_NginxOnlyAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB, cfg := setupPackageTestDB(t)

	nginxPkg := &models.MiddlewarePackage{
		Name:      models.MiddlewareNameNginx,
		Version:   "1.28.0",
		FileName:  "nginx.zip",
		FilePath:  "/tmp/nginx.zip",
		FileSize:  100,
		Status:    "active",
		OSType:    "rocky",
		OSVersion: "9.4",
	}
	redisPkg := &models.MiddlewarePackage{
		Name:      "redis",
		Version:   "6.2.20",
		FileName:  "redis.zip",
		FilePath:  "/tmp/redis.zip",
		FileSize:  100,
		Status:    "active",
		OSType:    "rocky",
		OSVersion: "9.4",
	}
	deletedNginx := &models.MiddlewarePackage{
		Name:      models.MiddlewareNameNginx,
		Version:   "1.27.0",
		FileName:  "old-nginx.zip",
		FilePath:  "/tmp/old-nginx.zip",
		FileSize:  100,
		Status:    "deleted",
		OSType:    "rocky",
		OSVersion: "9.4",
	}
	assert.NoError(t, testDB.Create(nginxPkg).Error)
	assert.NoError(t, testDB.Create(redisPkg).Error)
	assert.NoError(t, testDB.Create(deletedNginx).Error)

	packageAPI := NewPackageAPI(cfg)
	router := gin.New()
	router.GET("/packages", packageAPI.List)
	router.GET("/packages/:id", packageAPI.Get)
	router.DELETE("/packages/:id", packageAPI.Delete)

	t.Run("列表默认仅返回 nginx active 包", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/packages", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp map[string]interface{}
		assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		data := resp["data"].(map[string]interface{})
		packages := data["packages"].([]interface{})
		assert.Len(t, packages, 1)
		assert.Equal(t, models.MiddlewareNameNginx, packages[0].(map[string]interface{})["name"])
	})

	t.Run("显式查询非 nginx 包返回 400", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/packages?name=redis", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("读取非 nginx 包返回 404", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/packages/2", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("删除非 nginx 包返回 404", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodDelete, "/packages/2", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("删除 nginx 包仅做软删除", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodDelete, "/packages/1", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var pkg models.MiddlewarePackage
		assert.NoError(t, testDB.First(&pkg, 1).Error)
		assert.Equal(t, "deleted", pkg.Status)
	})
}
