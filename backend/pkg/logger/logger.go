package logger

import (
	"os"

	"github.com/sirupsen/logrus"
)

var Log *logrus.Logger

// Init 初始化日志
func Init() {
	Log = logrus.New()
	Log.SetOutput(os.Stdout)
	Log.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})
	Log.SetLevel(logrus.InfoLevel)
}

// Info 信息日志
func Info(args ...interface{}) {
	Log.Info(args...)
}

// Infof 格式化信息日志
func Infof(format string, args ...interface{}) {
	Log.Infof(format, args...)
}

// Warn 警告日志
func Warn(args ...interface{}) {
	Log.Warn(args...)
}

// Warnf 格式化警告日志
func Warnf(format string, args ...interface{}) {
	Log.Warnf(format, args...)
}

// Error 错误日志
func Error(args ...interface{}) {
	Log.Error(args...)
}

// Errorf 格式化错误日志
func Errorf(format string, args ...interface{}) {
	Log.Errorf(format, args...)
}

// Fatal 致命错误日志
func Fatal(args ...interface{}) {
	Log.Fatal(args...)
}

// Fatalf 格式化致命错误日志
func Fatalf(format string, args ...interface{}) {
	Log.Fatalf(format, args...)
}
