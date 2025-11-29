package api

import (
	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/utils"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// AuthAPI 认证API
type AuthAPI struct {
	config *config.Config
}

// NewAuthAPI 创建认证API
func NewAuthAPI(cfg *config.Config) *AuthAPI {
	return &AuthAPI{config: cfg}
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// Login 用户登录
func (a *AuthAPI) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 查找用户
	var user models.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		logger.Warnf("登录失败：用户不存在 - %s", req.Username)
		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	// 验证密码
	if !user.CheckPassword(req.Password) {
		logger.Warnf("登录失败：密码错误 - %s", req.Username)
		response.Unauthorized(c, "用户名或密码错误")
		return
	}

	// 生成token
	token, err := utils.GenerateToken(user.ID, user.Username, a.config)
	if err != nil {
		logger.Errorf("生成token失败: %v", err)
		response.InternalServerError(c, "生成token失败")
		return
	}

	logger.Infof("用户登录成功: %s", user.Username)

	response.Success(c, LoginResponse{
		Token: token,
		User:  &user,
	})
}

// Logout 用户登出
func (a *AuthAPI) Logout(c *gin.Context) {
	// 简单返回成功（前端删除token即可）
	response.SuccessWithMessage(c, "登出成功", nil)
}

// ProfileResponse 用户信息响应
type ProfileResponse struct {
	User *models.User `json:"user"`
}

// GetProfile 获取当前用户信息
func (a *AuthAPI) GetProfile(c *gin.Context) {
	// 从上下文获取用户ID（由中间件设置）
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "未授权")
		return
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	response.Success(c, ProfileResponse{
		User: &user,
	})
}

// ChangePasswordRequest 修改密码请求
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// ChangePassword 修改密码
func (a *AuthAPI) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "参数错误")
		return
	}

	// 从上下文获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "未授权")
		return
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		response.NotFound(c, "用户不存在")
		return
	}

	// 验证旧密码
	if !user.CheckPassword(req.OldPassword) {
		response.BadRequest(c, "旧密码错误")
		return
	}

	// 设置新密码
	if err := user.SetPassword(req.NewPassword); err != nil {
		logger.Errorf("设置密码失败: %v", err)
		response.InternalServerError(c, "修改密码失败")
		return
	}

	// 保存到数据库
	if err := db.DB.Save(&user).Error; err != nil {
		logger.Errorf("保存用户失败: %v", err)
		response.InternalServerError(c, "修改密码失败")
		return
	}

	logger.Infof("用户 %s 修改密码成功", user.Username)
	response.SuccessWithMessage(c, "密码修改成功", nil)
}
