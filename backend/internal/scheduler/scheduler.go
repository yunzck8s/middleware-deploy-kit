package scheduler

import (
	"time"

	"github.com/yunzck8s/middleware-deploy-kit/backend/internal/service"
	"github.com/yunzck8s/middleware-deploy-kit/backend/pkg/logger"
)

type Scheduler struct {
	notificationService *service.NotificationService
	ticker              *time.Ticker
	done                chan bool
}

func NewScheduler(ns *service.NotificationService) *Scheduler {
	return &Scheduler{
		notificationService: ns,
		done:                make(chan bool, 1),
	}
}

func (s *Scheduler) Start() {
	logger.Info("调度器启动")

	// 启动时立即执行一次
	go s.notificationService.CheckCertificateExpiry()

	// 计算下次凌晨2点的时间
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day()+1, 2, 0, 0, 0, now.Location())
	duration := next.Sub(now)

	// 首次延迟执行
	time.AfterFunc(duration, func() {
		s.notificationService.CheckCertificateExpiry()
		// 之后每24小时执行一次
		s.ticker = time.NewTicker(24 * time.Hour)
		go func() {
			for {
				select {
				case <-s.ticker.C:
					s.notificationService.CheckCertificateExpiry()
				case <-s.done:
					return
				}
			}
		}()
	})
}

func (s *Scheduler) Stop() {
	logger.Info("调度器停止")
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.done <- true
}
