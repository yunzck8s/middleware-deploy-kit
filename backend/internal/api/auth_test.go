package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	// 初始化 logger
	logger.Init()

	testDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// 自动迁移
	err = testDB.AutoMigrate(&models.User{})
	if err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return testDB
}

func TestAuthAPI_Login(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupTestDB(t)
	db.DB = testDB

	// 创建测试用户
	user := &models.User{Username: "testuser"}
	user.SetPassword("Test123456")
	testDB.Create(user)

	cfg := &config.Config{
		JWT: config.JWTConfig{
			Secret:     "test-secret",
			ExpireTime: 24 * time.Hour,
		},
	}
	authAPI := NewAuthAPI(cfg)

	router := gin.New()
	router.POST("/login", authAPI.Login)

	tests := []struct {
		name       string
		reqBody    map[string]string
		wantStatus int
		wantToken  bool
	}{
		{
			name: "成功登录",
			reqBody: map[string]string{
				"username": "testuser",
				"password": "Test123456",
			},
			wantStatus: http.StatusOK,
			wantToken:  true,
		},
		{
			name: "用户不存在",
			reqBody: map[string]string{
				"username": "notexist",
				"password": "Test123456",
			},
			wantStatus: http.StatusUnauthorized,
			wantToken:  false,
		},
		{
			name: "密码错误",
			reqBody: map[string]string{
				"username": "testuser",
				"password": "WrongPassword",
			},
			wantStatus: http.StatusUnauthorized,
			wantToken:  false,
		},
		{
			name: "缺少用户名",
			reqBody: map[string]string{
				"password": "Test123456",
			},
			wantStatus: http.StatusBadRequest,
			wantToken:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.reqBody)
			req, _ := http.NewRequest(http.MethodPost, "/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantToken {
				var resp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)

				data := resp["data"].(map[string]interface{})
				assert.NotEmpty(t, data["token"])

				user := data["user"].(map[string]interface{})
				assert.Equal(t, "testuser", user["username"])
			}
		})
	}
}

func TestAuthAPI_GetProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testDB := setupTestDB(t)
	db.DB = testDB

	// 创建测试用户
	user := &models.User{Username: "testuser"}
	user.SetPassword("Test123456")
	testDB.Create(user)

	cfg := &config.Config{}
	authAPI := NewAuthAPI(cfg)

	tests := []struct {
		name       string
		setUserID  bool
		userID     uint
		wantStatus int
	}{
		{
			name:       "成功获取用户信息",
			setUserID:  true,
			userID:     user.ID,
			wantStatus: http.StatusOK,
		},
		{
			name:       "未认证",
			setUserID:  false,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "用户不存在",
			setUserID:  true,
			userID:     9999,
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 为每个测试用例创建独立的路由
			router := gin.New()
			if tt.setUserID {
				// 添加中间件来设置 user_id
				router.Use(func(c *gin.Context) {
					c.Set("user_id", tt.userID)
					c.Next()
				})
			}
			router.GET("/profile", authAPI.GetProfile)

			req, _ := http.NewRequest(http.MethodGet, "/profile", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.wantStatus, w.Code)

			if tt.wantStatus == http.StatusOK {
				var resp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)

				data := resp["data"].(map[string]interface{})
				userInfo := data["user"].(map[string]interface{})
				assert.Equal(t, "testuser", userInfo["username"])
			}
		})
	}
}

func TestAuthAPI_Logout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{}
	authAPI := NewAuthAPI(cfg)

	router := gin.New()
	router.POST("/logout", authAPI.Logout)

	req, _ := http.NewRequest(http.MethodPost, "/logout", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, float64(200), resp["code"])
}
