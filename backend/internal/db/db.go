package db

import (
	"fmt"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

// Init 初始化数据库
func Init(cfg *config.Config) error {
	var err error

	// 打开数据库连接
	DB, err = gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{
		Logger: gormLogger.Default.LogMode(gormLogger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	logger.Info("数据库连接成功")

	// 自动迁移
	if err := AutoMigrate(); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	logger.Info("数据库迁移完成")

	// 初始化默认数据
	if err := InitDefaultData(); err != nil {
		return fmt.Errorf("failed to init default data: %w", err)
	}

	return nil
}

// AutoMigrate 自动迁移数据库表
func AutoMigrate() error {
	return DB.AutoMigrate(
		&models.User{},
		&models.MiddlewarePackage{},
		&models.Certificate{},
		&models.Server{},
		&models.ServerGroup{},
		&models.ServerGroupMapping{},
		&models.NginxConfig{},
		&models.NginxLocation{},
		&models.NginxUpstream{},
		&models.Deployment{},
		&models.DeploymentLog{},
		&models.DeploymentScript{},
		&models.DeploymentHook{},
	)
}

// InitDefaultData 初始化默认数据
func InitDefaultData() error {
	// 检查是否已存在管理员用户
	var count int64
	DB.Model(&models.User{}).Count(&count)

	if count == 0 {
		// 创建默认管理员用户
		admin := &models.User{
			Username: "admin",
		}
		if err := admin.SetPassword("admin123"); err != nil {
			return err
		}

		if err := DB.Create(admin).Error; err != nil {
			return err
		}

		logger.Info("默认管理员用户创建成功（用户名: admin, 密码: admin123）")
	}

	return nil
}

// Close 关闭数据库连接
func Close() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
