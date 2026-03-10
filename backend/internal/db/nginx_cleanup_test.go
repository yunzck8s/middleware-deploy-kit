package db

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupCleanupTestDB(t *testing.T) *gorm.DB {
	logger.Init()

	testDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	err = testDB.AutoMigrate(
		&models.Server{},
		&models.MiddlewarePackage{},
		&models.Deployment{},
		&models.DeploymentLog{},
		&models.DeploymentHook{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	DB = testDB
	return testDB
}

func TestCleanupLegacyNonNginxData(t *testing.T) {
	testDB := setupCleanupTestDB(t)
	tempDir := t.TempDir()

	existingFile := filepath.Join(tempDir, "redis.zip")
	assert.NoError(t, os.WriteFile(existingFile, []byte("redis"), 0o644))
	missingFile := filepath.Join(tempDir, "openssh.zip")

	server := &models.Server{Name: "server-1", Host: "127.0.0.1", Port: 22, Username: "root"}
	assert.NoError(t, testDB.Create(server).Error)

	nginxPkg := &models.MiddlewarePackage{Name: models.MiddlewareNameNginx, Version: "1.28.0", FileName: "nginx.zip", FilePath: filepath.Join(tempDir, "nginx.zip"), FileSize: 1, Status: "active"}
	redisPkg := &models.MiddlewarePackage{Name: "redis", Version: "6.2.20", FileName: "redis.zip", FilePath: existingFile, FileSize: 1, Status: "active"}
	opensshPkg := &models.MiddlewarePackage{Name: "openssh", Version: "10.0p2", FileName: "openssh.zip", FilePath: missingFile, FileSize: 1, Status: "active"}
	assert.NoError(t, testDB.Create(nginxPkg).Error)
	assert.NoError(t, testDB.Create(redisPkg).Error)
	assert.NoError(t, testDB.Create(opensshPkg).Error)

	deployment := &models.Deployment{Name: "redis deploy", Type: models.DeployTypePackage, ServerID: server.ID, Status: models.DeployStatusPending, PackageID: &redisPkg.ID}
	assert.NoError(t, testDB.Create(deployment).Error)
	assert.NoError(t, testDB.Create(&models.DeploymentLog{DeploymentID: deployment.ID, Step: 1, Action: "upload", Status: "success"}).Error)
	assert.NoError(t, testDB.Create(&models.DeploymentHook{DeploymentID: deployment.ID, HookType: "pre_deploy", ScriptType: "shell", Content: "echo pre"}).Error)

	assert.NoError(t, cleanupLegacyNonNginxData())
	assert.NoError(t, cleanupLegacyNonNginxData())

	var redisReloaded models.MiddlewarePackage
	assert.NoError(t, testDB.First(&redisReloaded, redisPkg.ID).Error)
	assert.Equal(t, "deleted", redisReloaded.Status)

	var opensshReloaded models.MiddlewarePackage
	assert.NoError(t, testDB.First(&opensshReloaded, opensshPkg.ID).Error)
	assert.Equal(t, "deleted", opensshReloaded.Status)

	var nginxReloaded models.MiddlewarePackage
	assert.NoError(t, testDB.First(&nginxReloaded, nginxPkg.ID).Error)
	assert.Equal(t, "active", nginxReloaded.Status)

	_, err := os.Stat(existingFile)
	assert.True(t, os.IsNotExist(err))

	var deletedDeployment models.Deployment
	assert.NoError(t, testDB.Unscoped().First(&deletedDeployment, deployment.ID).Error)
	assert.True(t, deletedDeployment.DeletedAt.Valid)

	var logCount int64
	testDB.Model(&models.DeploymentLog{}).Where("deployment_id = ?", deployment.ID).Count(&logCount)
	assert.Zero(t, logCount)

	var hookCount int64
	testDB.Model(&models.DeploymentHook{}).Where("deployment_id = ?", deployment.ID).Count(&hookCount)
	assert.Zero(t, hookCount)
}
