package response

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Code      int         `json:"code"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp string      `json:"timestamp"`
}

// Success 成功响应
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:      http.StatusOK,
		Message:   "成功",
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// SuccessWithMessage 成功响应（自定义消息）
func SuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:      http.StatusOK,
		Message:   message,
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// Error 错误响应
func Error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Code:      code,
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// ErrorWithData 错误响应（带数据）
func ErrorWithData(c *gin.Context, code int, message string, data interface{}) {
	c.JSON(code, Response{
		Code:      code,
		Message:   message,
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

// BadRequest 400 错误
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// Unauthorized 401 错误
func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message)
}

// Forbidden 403 错误
func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message)
}

// NotFound 404 错误
func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message)
}

// InternalServerError 500 错误
func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}
