package api

import (
	"encoding/json"
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
	"golang.org/x/crypto/ssh"
)

// RedisAPI Redis 实例管理 API
type RedisAPI struct {
	cfg *config.Config
}

// NewRedisAPI 创建 Redis API
func NewRedisAPI(cfg *config.Config) *RedisAPI {
	return &RedisAPI{cfg: cfg}
}

// redisConnInfo 从实例中解析 Redis 连接信息
type redisConnInfo struct {
	Port     string
	Password string
	ConfPath string
}

// parseRedisParams 从实例的 deploy_params 解析 Redis 连接参数
func parseRedisParams(instance *models.MiddlewareInstance) redisConnInfo {
	info := redisConnInfo{
		Port:     "6379",
		Password: "",
		ConfPath: "/data/redis/conf/redis.conf",
	}

	if instance.DeployParams == "" {
		return info
	}

	var params map[string]interface{}
	if err := json.Unmarshal([]byte(instance.DeployParams), &params); err != nil {
		return info
	}

	if p, ok := params["REDIS_PORT"]; ok {
		switch v := p.(type) {
		case string:
			info.Port = v
		case float64:
			info.Port = strconv.Itoa(int(v))
		}
	}
	if p, ok := params["REDIS_PASSWORD"].(string); ok && p != "" {
		info.Password = p
	}
	if p, ok := params["REDIS_CONF_PATH"].(string); ok && p != "" {
		info.ConfPath = p
	}

	return info
}

// loadInstanceAndServer 加载实例和关联的服务器
func (r *RedisAPI) loadInstanceAndServer(c *gin.Context) (*models.MiddlewareInstance, *models.Server, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "无效的实例 ID")
		return nil, nil, false
	}

	var instance models.MiddlewareInstance
	if err := db.DB.Preload("Server").First(&instance, id).Error; err != nil {
		response.NotFound(c, "实例不存在")
		return nil, nil, false
	}

	if instance.Type != "redis" {
		response.BadRequest(c, "该实例不是 Redis 类型")
		return nil, nil, false
	}

	return &instance, &instance.Server, true
}

// sshExec 在服务器上执行命令并返回输出
func sshExec(sshClient *ssh.Client, cmd string) (string, error) {
	session, err := sshClient.NewSession()
	if err != nil {
		return "", fmt.Errorf("创建 SSH 会话失败: %v", err)
	}
	defer session.Close()

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return string(output), fmt.Errorf("命令执行失败: %v, 输出: %s", err, string(output))
	}
	return string(output), nil
}

// buildRedisCLI 构建 redis-cli 命令前缀
// 自动探测 redis-cli 路径：优先 /usr/local/redis/bin/redis-cli，回退到 PATH
func buildRedisCLI(info redisConnInfo) string {
	// 使用 shell 探测：先检查离线安装的路径，再检查 PATH
	cli := "$(if [ -x /usr/local/redis/bin/redis-cli ]; then echo /usr/local/redis/bin/redis-cli; else echo redis-cli; fi)"
	cmd := fmt.Sprintf("%s -p %s", cli, info.Port)
	if info.Password != "" {
		cmd += fmt.Sprintf(" -a '%s' --no-auth-warning", info.Password)
	}
	return cmd
}

// GetConfig 读取 Redis 配置文件
func (r *RedisAPI) GetConfig(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	// 使用 sudo cat 读取配置文件（配置文件可能属于 redis 用户，SFTP 权限不足）
	output, err := sshExec(sshClient, fmt.Sprintf("sudo cat %s", info.ConfPath))
	if err != nil {
		response.InternalServerError(c, "读取配置文件失败: "+err.Error())
		return
	}

	response.Success(c, gin.H{
		"content":   output,
		"conf_path": info.ConfPath,
	})
}

// UpdateConfigRequest 更新配置请求
type UpdateConfigRequest struct {
	Content        string `json:"content" binding:"required"`
	RestartService bool   `json:"restart_service"`
}

// UpdateConfig 写入 Redis 配置文件并可选重启服务
func (r *RedisAPI) UpdateConfig(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	var req UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	// 备份原配置（使用 sudo）
	backupPath := info.ConfPath + ".bak." + time.Now().Format("20060102150405")
	if _, err := sshExec(sshClient, fmt.Sprintf("sudo cp %s %s", info.ConfPath, backupPath)); err != nil {
		logger.Warnf("备份配置失败（可能文件不存在）: %v", err)
	}

	// 写入新配置（通过 sudo tee 写入，解决权限问题）
	// 使用 heredoc 方式避免特殊字符转义问题
	tmpPath := "/tmp/redis_conf_" + time.Now().Format("20060102150405") + ".tmp"
	writeCmd := fmt.Sprintf("cat > %s << 'REDIS_CONF_EOF'\n%s\nREDIS_CONF_EOF", tmpPath, req.Content)
	if _, err := sshExec(sshClient, writeCmd); err != nil {
		response.InternalServerError(c, "写入临时文件失败: "+err.Error())
		return
	}

	// 原子替换配置文件
	if _, err := sshExec(sshClient, fmt.Sprintf("sudo mv %s %s && sudo chown redis:redis %s", tmpPath, info.ConfPath, info.ConfPath)); err != nil {
		response.InternalServerError(c, "替换配置文件失败: "+err.Error())
		return
	}

	result := gin.H{
		"backup_path": backupPath,
		"restarted":   false,
	}

	// 可选重启服务
	if req.RestartService {
		// 尝试 systemctl，失败则尝试 redis-cli shutdown + 重新启动
		output, err := sshExec(sshClient, "sudo systemctl restart redis 2>&1 || sudo systemctl restart redis-server 2>&1")
		if err != nil {
			// 回退：使用 redis-cli shutdown + 脚本重启
			logger.Warnf("systemctl 重启 Redis 失败: %v, 尝试 redis-cli 方式", err)
			cli := buildRedisCLI(info)
			output, err = sshExec(sshClient, fmt.Sprintf("%s shutdown nosave 2>&1; sleep 1; redis-server %s --daemonize yes 2>&1", cli, info.ConfPath))
			if err != nil {
				result["restart_error"] = fmt.Sprintf("重启失败: %s", output)
			} else {
				result["restarted"] = true
			}
		} else {
			result["restarted"] = true
			_ = output
		}
	}

	response.Success(c, result)
}

// TestConnection 测试 Redis 连接
func (r *RedisAPI) TestConnection(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	cli := buildRedisCLI(info)
	result := gin.H{}

	// PING 测试
	start := time.Now()
	pingOutput, err := sshExec(sshClient, fmt.Sprintf("%s ping", cli))
	latency := time.Since(start).Milliseconds()

	if err != nil {
		result["connected"] = false
		result["error"] = fmt.Sprintf("连接失败: %s", strings.TrimSpace(pingOutput))
		response.Success(c, result)
		return
	}

	pingResult := strings.TrimSpace(pingOutput)
	result["connected"] = pingResult == "PONG"
	result["ping"] = pingResult
	result["latency_ms"] = latency

	// 获取 INFO server
	infoOutput, err := sshExec(sshClient, fmt.Sprintf("%s INFO server", cli))
	if err == nil {
		result["info"] = parseRedisInfo(infoOutput)
	}

	// 获取 INFO clients
	clientsOutput, err := sshExec(sshClient, fmt.Sprintf("%s INFO clients", cli))
	if err == nil {
		clientsInfo := parseRedisInfo(clientsOutput)
		// 合并到 info 中
		if infoMap, ok := result["info"].(map[string]string); ok {
			for k, v := range clientsInfo {
				infoMap[k] = v
			}
		}
	}

	// 获取 DBSIZE
	dbsizeOutput, err := sshExec(sshClient, fmt.Sprintf("%s DBSIZE", cli))
	if err == nil {
		result["dbsize"] = strings.TrimSpace(dbsizeOutput)
	}

	response.Success(c, result)
}

// parseRedisInfo 解析 Redis INFO 输出为 key-value map
func parseRedisInfo(raw string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 {
			result[parts[0]] = parts[1]
		}
	}
	return result
}

// ScanKeysRequest SCAN 请求
type ScanKeysRequest struct {
	Pattern string `json:"pattern"`
	Count   int    `json:"count"`
}

// ScanKeys 使用 SCAN 扫描 key
func (r *RedisAPI) ScanKeys(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	var req ScanKeysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Pattern = "*"
	}
	if req.Pattern == "" {
		req.Pattern = "*"
	}
	if req.Count <= 0 || req.Count > 500 {
		req.Count = 100
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	cli := buildRedisCLI(info)

	// 使用 --scan --pattern 安全地扫描 key（不阻塞）
	// 限制数量用 head
	scanCmd := fmt.Sprintf("%s --scan --pattern '%s' | head -n %d", cli, req.Pattern, req.Count)
	output, err := sshExec(sshClient, scanCmd)
	if err != nil {
		// head 会导致 pipe broken，忽略
		if output == "" {
			response.InternalServerError(c, "扫描 key 失败: "+err.Error())
			return
		}
	}

	keys := []string{}
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			keys = append(keys, line)
		}
	}

	// 批量获取 key 的类型和 TTL
	type KeyInfo struct {
		Key  string `json:"key"`
		Type string `json:"type"`
		TTL  int64  `json:"ttl"`
	}

	keyInfos := make([]KeyInfo, 0, len(keys))

	// 使用 pipeline 批量获取（每个 key 两条命令：TYPE + TTL）
	if len(keys) > 0 {
		var pipelineCmds []string
		for _, key := range keys {
			pipelineCmds = append(pipelineCmds, fmt.Sprintf("TYPE %s", key))
			pipelineCmds = append(pipelineCmds, fmt.Sprintf("TTL %s", key))
		}

		// 通过 redis-cli --pipe-mode 或逐个获取
		// 简单实现：用 printf + redis-cli --pipe 方式
		pipeCmd := "printf '"
		for _, key := range keys {
			pipeCmd += fmt.Sprintf("TYPE %s\\nTTL %s\\n", key, key)
		}
		pipeCmd += fmt.Sprintf("' | %s", cli)

		pipeOutput, err := sshExec(sshClient, pipeCmd)
		if err == nil {
			lines := strings.Split(strings.TrimSpace(pipeOutput), "\n")
			for i := 0; i < len(keys) && i*2+1 < len(lines); i++ {
				typeLine := strings.TrimSpace(lines[i*2])
				ttlLine := strings.TrimSpace(lines[i*2+1])

				ttl, _ := strconv.ParseInt(ttlLine, 10, 64)
				keyInfos = append(keyInfos, KeyInfo{
					Key:  keys[i],
					Type: typeLine,
					TTL:  ttl,
				})
			}
		} else {
			// fallback：只返回 key 列表，不带类型和 TTL
			for _, key := range keys {
				keyInfos = append(keyInfos, KeyInfo{Key: key, Type: "unknown", TTL: -2})
			}
		}
	}

	response.Success(c, gin.H{
		"keys":  keyInfos,
		"total": len(keyInfos),
	})
}

// GetKeyRequest 获取 key 值请求
type GetKeyRequest struct {
	Key string `json:"key" binding:"required"`
}

// GetKey 获取单个 key 的值
func (r *RedisAPI) GetKey(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	var req GetKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: key 不能为空")
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	cli := buildRedisCLI(info)

	// 先获取类型
	typeOutput, err := sshExec(sshClient, fmt.Sprintf("%s TYPE '%s'", cli, req.Key))
	if err != nil {
		response.InternalServerError(c, "获取 key 类型失败: "+err.Error())
		return
	}
	keyType := strings.TrimSpace(typeOutput)

	if keyType == "none" {
		response.NotFound(c, "key 不存在")
		return
	}

	// 获取 TTL
	ttlOutput, _ := sshExec(sshClient, fmt.Sprintf("%s TTL '%s'", cli, req.Key))
	ttl, _ := strconv.ParseInt(strings.TrimSpace(ttlOutput), 10, 64)

	// 根据类型获取值
	var value interface{}
	var valueCmd string

	switch keyType {
	case "string":
		valueCmd = fmt.Sprintf("%s GET '%s'", cli, req.Key)
		output, err := sshExec(sshClient, valueCmd)
		if err != nil {
			response.InternalServerError(c, "获取值失败: "+err.Error())
			return
		}
		value = strings.TrimSpace(output)

	case "list":
		valueCmd = fmt.Sprintf("%s LRANGE '%s' 0 99", cli, req.Key)
		output, err := sshExec(sshClient, valueCmd)
		if err != nil {
			response.InternalServerError(c, "获取值失败: "+err.Error())
			return
		}
		value = parseRedisListOutput(output)

	case "set":
		valueCmd = fmt.Sprintf("%s SMEMBERS '%s'", cli, req.Key)
		output, err := sshExec(sshClient, valueCmd)
		if err != nil {
			response.InternalServerError(c, "获取值失败: "+err.Error())
			return
		}
		value = parseRedisListOutput(output)

	case "zset":
		valueCmd = fmt.Sprintf("%s ZRANGE '%s' 0 99 WITHSCORES", cli, req.Key)
		output, err := sshExec(sshClient, valueCmd)
		if err != nil {
			response.InternalServerError(c, "获取值失败: "+err.Error())
			return
		}
		value = parseRedisListOutput(output)

	case "hash":
		valueCmd = fmt.Sprintf("%s HGETALL '%s'", cli, req.Key)
		output, err := sshExec(sshClient, valueCmd)
		if err != nil {
			response.InternalServerError(c, "获取值失败: "+err.Error())
			return
		}
		// HGETALL 返回 field value 交替
		items := parseRedisListOutput(output)
		hashMap := make(map[string]string)
		for i := 0; i+1 < len(items); i += 2 {
			hashMap[items[i]] = items[i+1]
		}
		value = hashMap

	default:
		value = fmt.Sprintf("不支持的类型: %s", keyType)
	}

	response.Success(c, gin.H{
		"key":   req.Key,
		"type":  keyType,
		"ttl":   ttl,
		"value": value,
	})
}

// parseRedisListOutput 解析 redis-cli 列表输出（带行号前缀）
func parseRedisListOutput(output string) []string {
	var items []string
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line == "(empty list or set)" || line == "(empty array)" {
			continue
		}
		// 去掉行号前缀，如 "1) \"value\""
		if idx := strings.Index(line, ") "); idx > 0 {
			val := line[idx+2:]
			// 去掉引号
			val = strings.Trim(val, "\"")
			items = append(items, val)
		} else {
			items = append(items, line)
		}
	}
	return items
}

// DeleteKeyRequest 删除 key 请求
type DeleteKeyRequest struct {
	Key string `json:"key" binding:"required"`
}

// DeleteKey 删除 key
func (r *RedisAPI) DeleteKey(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	var req DeleteKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: key 不能为空")
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	cli := buildRedisCLI(info)
	output, err := sshExec(sshClient, fmt.Sprintf("%s DEL '%s'", cli, req.Key))
	if err != nil {
		response.InternalServerError(c, "删除 key 失败: "+err.Error())
		return
	}

	deleted := strings.TrimSpace(output)
	response.Success(c, gin.H{
		"deleted": deleted,
		"key":     req.Key,
	})
}

// SeedTestData 写入测试数据（方便验证数据浏览器功能）
func (r *RedisAPI) SeedTestData(c *gin.Context) {
	instance, server, ok := r.loadInstanceAndServer(c)
	if !ok {
		return
	}

	info := parseRedisParams(instance)

	sshClient, _, err := connectToServer(server)
	if err != nil {
		response.InternalServerError(c, "SSH 连接失败: "+err.Error())
		return
	}
	defer sshClient.Close()

	cli := buildRedisCLI(info)

	// 写入多种类型的测试数据
	commands := []string{
		// string 类型
		fmt.Sprintf("%s SET 'test:string:hello' 'Hello Redis!'", cli),
		fmt.Sprintf("%s SET 'test:string:counter' '42'", cli),
		fmt.Sprintf(`%s SET 'test:string:json' '{"name":"test","version":"7.2.7","enabled":true}'`, cli),
		fmt.Sprintf("%s SET 'test:string:expiring' 'I will expire' EX 3600", cli),
		// list 类型
		fmt.Sprintf("%s RPUSH 'test:list:colors' red green blue yellow purple", cli),
		fmt.Sprintf("%s RPUSH 'test:list:queue' task-001 task-002 task-003", cli),
		// set 类型
		fmt.Sprintf("%s SADD 'test:set:tags' golang redis docker kubernetes nginx", cli),
		// zset 类型（排行榜）
		fmt.Sprintf("%s ZADD 'test:zset:scores' 100 alice 85 bob 92 charlie 78 dave 95 eve", cli),
		// hash 类型
		fmt.Sprintf("%s HSET 'test:hash:user:1' name '张三' age 28 email 'zhangsan@example.com' role admin", cli),
		fmt.Sprintf("%s HSET 'test:hash:config' max_connections 1000 timeout 30 log_level info", cli),
	}

	succeeded := 0
	for _, cmd := range commands {
		if _, err := sshExec(sshClient, cmd); err != nil {
			logger.Warnf("写入测试数据失败: %v", err)
		} else {
			succeeded++
		}
	}

	response.Success(c, gin.H{
		"total":     len(commands),
		"succeeded": succeeded,
		"message":   fmt.Sprintf("已写入 %d 条测试数据（string×4, list×2, set×1, zset×1, hash×2）", succeeded),
	})
}
