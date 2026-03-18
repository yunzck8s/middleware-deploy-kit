package api

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/config"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/db"
	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/models"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/response"
)

// RedisClusterAPI Redis 集群 API
type RedisClusterAPI struct {
	cfg           *config.Config
	deploymentAPI *DeploymentAPI
}

// NewRedisClusterAPI 创建 Redis 集群 API 实例
func NewRedisClusterAPI(cfg *config.Config, deploymentAPI *DeploymentAPI) *RedisClusterAPI {
	return &RedisClusterAPI{cfg: cfg, deploymentAPI: deploymentAPI}
}

// CreateClusterRequest 创建集群请求
type CreateClusterRequest struct {
	Name        string              `json:"name" binding:"required"`
	ClusterMode string              `json:"cluster_mode" binding:"required"` // "3x2" | "6x1"
	Password    string              `json:"password"`
	PackageID   uint                `json:"package_id" binding:"required"`
	Nodes       []ClusterNodeInput  `json:"nodes" binding:"required"`
}

// ClusterNodeInput 节点输入
type ClusterNodeInput struct {
	ServerID uint  `json:"server_id" binding:"required"`
	Ports    []int `json:"ports" binding:"required"`
}

// Create 创建 Redis 集群
func (a *RedisClusterAPI) Create(c *gin.Context) {
	var req CreateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	// 校验集群模式
	if req.ClusterMode != "3x2" && req.ClusterMode != "6x1" {
		response.BadRequest(c, "集群模式必须为 3x2 或 6x1")
		return
	}

	// 校验总端口数 = 6
	totalPorts := 0
	for _, node := range req.Nodes {
		totalPorts += len(node.Ports)
	}
	if totalPorts != 6 {
		response.BadRequest(c, fmt.Sprintf("集群需要恰好 6 个节点，当前配置了 %d 个", totalPorts))
		return
	}

	// 校验拓扑：3x2 需要 3 台服务器各 2 端口，6x1 需要 6 台各 1 端口
	if req.ClusterMode == "3x2" {
		if len(req.Nodes) != 3 {
			response.BadRequest(c, "3x2 模式需要恰好 3 台服务器")
			return
		}
		for _, node := range req.Nodes {
			if len(node.Ports) != 2 {
				response.BadRequest(c, "3x2 模式每台服务器需要恰好 2 个端口")
				return
			}
		}
	} else {
		if len(req.Nodes) != 6 {
			response.BadRequest(c, "6x1 模式需要恰好 6 台服务器")
			return
		}
		for _, node := range req.Nodes {
			if len(node.Ports) != 1 {
				response.BadRequest(c, "6x1 模式每台服务器需要恰好 1 个端口")
				return
			}
		}
	}

	// 验证离线包存在
	var pkg models.MiddlewarePackage
	if err := db.DB.Where("id = ? AND name = ? AND status = ?", req.PackageID, models.MiddlewareNameRedis, "active").First(&pkg).Error; err != nil {
		response.BadRequest(c, "Redis 离线包不存在或已删除")
		return
	}

	// 验证所有服务器存在
	serverIDs := make([]uint, 0, len(req.Nodes))
	for _, node := range req.Nodes {
		serverIDs = append(serverIDs, node.ServerID)
	}
	var servers []models.Server
	if err := db.DB.Where("id IN ?", serverIDs).Find(&servers).Error; err != nil || len(servers) != len(serverIDs) {
		response.BadRequest(c, "部分服务器不存在")
		return
	}

	// 创建集群记录
	packageID := req.PackageID
	cluster := models.RedisCluster{
		Name:        req.Name,
		Password:    req.Password,
		ClusterMode: req.ClusterMode,
		Status:      "pending",
		TotalNodes:  6,
		PackageID:   &packageID,
		Version:     pkg.Version,
	}

	if err := db.DB.Create(&cluster).Error; err != nil {
		logger.Errorf("创建 Redis 集群失败: %v", err)
		response.InternalServerError(c, "创建集群失败")
		return
	}

	// 创建集群节点 + 中间件实例
	for _, nodeInput := range req.Nodes {
		for _, port := range nodeInput.Ports {
			// 创建中间件实例
			instance := models.MiddlewareInstance{
				Name:      fmt.Sprintf("%s-node-%d-%d", req.Name, nodeInput.ServerID, port),
				Type:      models.MiddlewareNameRedis,
				ServerID:  nodeInput.ServerID,
				PackageID: &packageID,
				Version:   pkg.Version,
				Status:    "pending",
			}
			if err := db.DB.Create(&instance).Error; err != nil {
				logger.Errorf("创建 Redis 实例失败: %v", err)
				response.InternalServerError(c, "创建集群节点实例失败")
				return
			}

			// 创建集群节点
			node := models.RedisClusterNode{
				ClusterID:  cluster.ID,
				ServerID:   nodeInput.ServerID,
				Port:       port,
				Role:       "pending",
				InstanceID: &instance.ID,
				Status:     "pending",
			}
			if err := db.DB.Create(&node).Error; err != nil {
				logger.Errorf("创建集群节点失败: %v", err)
				response.InternalServerError(c, "创建集群节点失败")
				return
			}
		}
	}

	// 重新加载含节点数据
	db.DB.Preload("Nodes").Preload("Nodes.Server").First(&cluster, cluster.ID)

	logger.Infof("Redis 集群创建成功: %s（模式: %s）", cluster.Name, cluster.ClusterMode)
	response.SuccessWithMessage(c, "集群创建成功", cluster)
}

// List 获取集群列表
func (a *RedisClusterAPI) List(c *gin.Context) {
	var clusters []models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		Order("created_at DESC").Find(&clusters).Error; err != nil {
		logger.Errorf("查询 Redis 集群列表失败: %v", err)
		response.InternalServerError(c, "查询失败")
		return
	}

	response.Success(c, clusters)
}

// Get 获取集群详情
func (a *RedisClusterAPI) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		First(&cluster, uint(id)).Error; err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	response.Success(c, cluster)
}

// Delete 删除集群
func (a *RedisClusterAPI) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").First(&cluster, uint(id)).Error; err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	if cluster.Status == "deploying" || cluster.Status == "initializing" {
		response.BadRequest(c, "集群正在部署或初始化中，无法删除")
		return
	}

	// 软删除关联的实例
	for _, node := range cluster.Nodes {
		if node.InstanceID != nil {
			db.DB.Model(&models.MiddlewareInstance{}).Where("id = ?", *node.InstanceID).Update("status", "deleted")
		}
	}

	// 删除节点和集群
	db.DB.Where("cluster_id = ?", cluster.ID).Delete(&models.RedisClusterNode{})
	db.DB.Delete(&cluster)

	logger.Infof("Redis 集群已删除: %s (ID: %d)", cluster.Name, cluster.ID)
	response.SuccessWithMessage(c, "集群已删除", nil)
}

// DeployRequest 部署请求
type DeployRequest struct {
	AutoInit bool `json:"auto_init"` // 部署完成后自动初始化集群
}

// Deploy 部署集群所有节点
func (a *RedisClusterAPI) Deploy(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var deployReq DeployRequest
	c.ShouldBindJSON(&deployReq)

	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		First(&cluster, uint(id)).Error; err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	if cluster.Status != "pending" && cluster.Status != "failed" {
		response.BadRequest(c, "集群当前状态不允许部署")
		return
	}

	if cluster.PackageID == nil {
		response.BadRequest(c, "集群未关联离线包")
		return
	}

	// 更新集群状态
	db.DB.Model(&cluster).Update("status", "deploying")

	// 按 server 分组，同一台机器的多端口合并为一个部署任务
	serverPorts := make(map[uint][]int)
	serverNodes := make(map[uint][]models.RedisClusterNode)
	for _, node := range cluster.Nodes {
		serverPorts[node.ServerID] = append(serverPorts[node.ServerID], node.Port)
		serverNodes[node.ServerID] = append(serverNodes[node.ServerID], node)
	}

	var deploymentIDs []uint

	for serverID, ports := range serverPorts {
		// 将端口列表转为逗号分隔字符串
		portStrs := make([]string, len(ports))
		for i, p := range ports {
			portStrs[i] = strconv.Itoa(p)
		}
		portsStr := strings.Join(portStrs, ",")

		// 构建部署参数
		deployParams := fmt.Sprintf(`{"REDIS_CLUSTER_ENABLED":"true","REDIS_PORTS":"%s","REDIS_PASSWORD":"%s"}`,
			portsStr, cluster.Password)

		// 创建部署任务
		deployment := models.Deployment{
			Name:        fmt.Sprintf("%s - 节点部署 (Server %d)", cluster.Name, serverID),
			Description: fmt.Sprintf("Redis 集群 %s 节点部署", cluster.Name),
			Type:        "package",
			ServerID:    serverID,
			Status:      models.DeployStatusPending,
			PackageID:   cluster.PackageID,
			TargetPath:  "/tmp",
			DeployParams: deployParams,
		}

		if err := db.DB.Create(&deployment).Error; err != nil {
			logger.Errorf("创建集群部署任务失败: %v", err)
			db.DB.Model(&cluster).Updates(map[string]interface{}{"status": "failed", "error_msg": "创建部署任务失败"})
			response.InternalServerError(c, "创建部署任务失败")
			return
		}

		deploymentIDs = append(deploymentIDs, deployment.ID)

		// 更新节点状态和关联部署 ID
		for _, node := range serverNodes[serverID] {
			db.DB.Model(&models.RedisClusterNode{}).Where("id = ?", node.ID).Updates(map[string]interface{}{
				"status":        "deploying",
				"deployment_id": deployment.ID,
			})
		}
	}

	// 后台 goroutine: 执行所有部署任务并监控完成状态
	go func() {
		clusterID := cluster.ID
		autoInit := deployReq.AutoInit

		// 执行所有部署任务
		for _, deployID := range deploymentIDs {
			var dep models.Deployment
			if err := db.DB.Preload("Server").Preload("Package").First(&dep, deployID).Error; err != nil {
				continue
			}
			a.deploymentAPI.executeDeployment(&dep)
		}

		// 等待所有部署完成（轮询）
		allSuccess := true
		allDone := false
		for i := 0; i < 360; i++ { // 最多等待 30 分钟
			time.Sleep(5 * time.Second)

			allDone = true
			allSuccess = true
			for _, deployID := range deploymentIDs {
				var dep models.Deployment
				db.DB.First(&dep, deployID)
				if dep.Status == models.DeployStatusPending || dep.Status == models.DeployStatusRunning {
					allDone = false
					break
				}
				if dep.Status != models.DeployStatusSuccess {
					allSuccess = false
				}
			}
			if allDone {
				break
			}
		}

		// 超时未完成视为失败
		if !allDone {
			allSuccess = false
		}

		if allSuccess {
			db.DB.Model(&models.RedisCluster{}).Where("id = ?", clusterID).Update("status", "deployed")
			// 更新所有节点状态
			db.DB.Model(&models.RedisClusterNode{}).Where("cluster_id = ?", clusterID).Update("status", "running")
			// 同步更新关联的 MiddlewareInstance 状态
			var nodes []models.RedisClusterNode
			db.DB.Where("cluster_id = ?", clusterID).Find(&nodes)
			for _, node := range nodes {
				if node.InstanceID != nil {
					db.DB.Model(&models.MiddlewareInstance{}).Where("id = ?", *node.InstanceID).Update("status", "running")
				}
			}

			if autoInit {
				// 自动初始化
				a.initializeCluster(clusterID)
			}
		} else {
			db.DB.Model(&models.RedisCluster{}).Where("id = ?", clusterID).Updates(map[string]interface{}{
				"status":    "failed",
				"error_msg": "部分节点部署失败",
			})
		}
	}()

	response.SuccessWithMessage(c, "集群部署已启动", gin.H{
		"cluster_id":     cluster.ID,
		"deployment_ids": deploymentIDs,
	})
}

// Initialize 初始化集群（redis-cli --cluster create）
func (a *RedisClusterAPI) Initialize(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		First(&cluster, uint(id)).Error; err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	if cluster.Status != "deployed" && cluster.Status != "failed" {
		response.BadRequest(c, "集群当前状态不允许初始化，需要先完成部署")
		return
	}

	db.DB.Model(&cluster).Update("status", "initializing")

	go a.initializeCluster(cluster.ID)

	response.SuccessWithMessage(c, "集群初始化已启动", nil)
}

// initializeCluster 执行集群初始化
func (a *RedisClusterAPI) initializeCluster(clusterID uint) {
	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		First(&cluster, clusterID).Error; err != nil {
		return
	}

	db.DB.Model(&cluster).Update("status", "initializing")

	// 构建节点地址列表
	nodeAddrs := make([]string, 0, len(cluster.Nodes))
	for _, node := range cluster.Nodes {
		nodeAddrs = append(nodeAddrs, fmt.Sprintf("%s:%d", node.Server.Host, node.Port))
	}

	// 取第一个节点执行 redis-cli --cluster create
	firstNode := cluster.Nodes[0]

	// 构建 redis-cli --cluster create 命令
	cmd := fmt.Sprintf("redis-cli --cluster create %s --cluster-replicas 1 --cluster-yes",
		strings.Join(nodeAddrs, " "))
	if cluster.Password != "" {
		cmd += fmt.Sprintf(" -a '%s'", cluster.Password)
	}

	// SSH 到第一个节点执行
	sshClient, sftpClient, err := connectToServer(&firstNode.Server)
	if err != nil {
		db.DB.Model(&cluster).Updates(map[string]interface{}{
			"status":    "failed",
			"error_msg": fmt.Sprintf("SSH 连接失败: %v", err),
		})
		return
	}
	defer sshClient.Close()
	defer sftpClient.Close()

	session, err := sshClient.NewSession()
	if err != nil {
		db.DB.Model(&cluster).Updates(map[string]interface{}{
			"status":    "failed",
			"error_msg": fmt.Sprintf("创建 SSH 会话失败: %v", err),
		})
		return
	}
	defer session.Close()

	// 设置 PATH 以包含 redis-cli
	fullCmd := fmt.Sprintf("export PATH=/usr/local/redis/bin:$PATH && %s", cmd)
	output, err := session.CombinedOutput(fullCmd)
	if err != nil {
		db.DB.Model(&cluster).Updates(map[string]interface{}{
			"status":    "failed",
			"error_msg": fmt.Sprintf("集群初始化失败: %v\n输出: %s", err, string(output)),
		})
		return
	}

	logger.Infof("Redis 集群初始化输出: %s", string(output))

	// 解析输出，获取节点 ID 和角色
	a.parseClusterNodes(cluster.ID, firstNode.Server)

	db.DB.Model(&cluster).Updates(map[string]interface{}{
		"status":    "running",
		"error_msg": "",
	})

	logger.Infof("Redis 集群初始化完成: %s", cluster.Name)
}

// parseClusterNodes 通过 cluster nodes 命令获取节点信息
func (a *RedisClusterAPI) parseClusterNodes(clusterID uint, server models.Server) {
	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").First(&cluster, clusterID).Error; err != nil {
		return
	}

	sshClient, sftpClient, err := connectToServer(&server)
	if err != nil {
		return
	}
	defer sshClient.Close()
	defer sftpClient.Close()

	session, err := sshClient.NewSession()
	if err != nil {
		return
	}
	defer session.Close()

	cmd := "export PATH=/usr/local/redis/bin:$PATH && redis-cli"
	if cluster.Password != "" {
		cmd += fmt.Sprintf(" -a '%s'", cluster.Password)
	}

	// 使用第一个节点的端口
	if len(cluster.Nodes) > 0 {
		cmd += fmt.Sprintf(" -p %d", cluster.Nodes[0].Port)
	}
	cmd += " cluster nodes"

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		logger.Warnf("获取集群节点信息失败: %v", err)
		return
	}

	// 解析 cluster nodes 输出
	// 格式: <id> <ip:port@cport> <flags> <master> <ping-sent> <pong-recv> <config-epoch> <link-state> <slot>
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Warning") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}

		nodeID := parts[0]
		addrPart := strings.Split(parts[1], "@")[0] // ip:port
		flags := parts[2]

		// 确定角色
		role := "replica"
		if strings.Contains(flags, "master") {
			role = "master"
		}

		// 根据 host:port 匹配节点记录并更新
		addrParts := strings.Split(addrPart, ":")
		if len(addrParts) != 2 {
			continue
		}
		host := addrParts[0]
		port, err := strconv.Atoi(addrParts[1])
		if err != nil {
			continue
		}

		for _, node := range cluster.Nodes {
			if node.Port == port && node.Server.Host == host {
				db.DB.Model(&models.RedisClusterNode{}).Where("id = ?", node.ID).Updates(map[string]interface{}{
					"node_id": nodeID,
					"role":    role,
				})
			}
		}
	}
}

// Status 获取集群实时状态
func (a *RedisClusterAPI) Status(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的 ID")
		return
	}

	var cluster models.RedisCluster
	if err := db.DB.Preload("Nodes").Preload("Nodes.Server").
		First(&cluster, uint(id)).Error; err != nil {
		response.NotFound(c, "集群不存在")
		return
	}

	// 如果集群正在部署，检查部署进度
	if cluster.Status == "deploying" {
		for i, node := range cluster.Nodes {
			if node.DeploymentID != nil {
				var dep models.Deployment
				if err := db.DB.First(&dep, *node.DeploymentID).Error; err == nil {
					cluster.Nodes[i].Status = string(dep.Status)
				}
			}
		}
	}

	response.Success(c, cluster)
}
