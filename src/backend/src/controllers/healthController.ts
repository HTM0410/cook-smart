import { Request, Response } from 'express';
import { sequelize } from '../config/database-supabase';
import os from 'os';
import logger from '../config/logger';

/**
 * Basic health check
 */
export const healthCheck = async (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CookSmart API',
    version: '1.0.0',
    uptime: process.uptime(),
  });
};

/**
 * Detailed health check with all dependencies
 */
export const detailedHealthCheck = async (req: Request, res: Response) => {
  const healthStatus: any = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CookSmart API',
    version: '1.0.0',
    uptime: process.uptime(),
    checks: {},
  };

  // Check database connection
  try {
    await sequelize.authenticate();
    healthStatus.checks.database = {
      status: 'UP',
      responseTime: 0,
    };
  } catch (error: any) {
    healthStatus.checks.database = {
      status: 'DOWN',
      error: error.message,
    };
    healthStatus.status = 'DEGRADED';
    logger.error('Database health check failed', error);
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);

  healthStatus.checks.memory = {
    status: parseFloat(memoryUsagePercent) < 90 ? 'UP' : 'WARNING',
    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    systemTotal: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
    systemFree: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
    usagePercent: `${memoryUsagePercent}%`,
  };

  // Check CPU usage
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  const loadAverage = os.loadavg();

  healthStatus.checks.cpu = {
    status: 'UP',
    count: cpuCount,
    model: cpus[0]?.model || 'Unknown',
    loadAverage: {
      '1min': loadAverage[0].toFixed(2),
      '5min': loadAverage[1].toFixed(2),
      '15min': loadAverage[2].toFixed(2),
    },
  };

  // Check disk space (if available)
  healthStatus.checks.system = {
    status: 'UP',
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    hostname: os.hostname(),
  };

  // Set overall status
  const checks = Object.values(healthStatus.checks);
  if (checks.some((check: any) => check.status === 'DOWN')) {
    healthStatus.status = 'DOWN';
    res.status(503);
  } else if (checks.some((check: any) => check.status === 'WARNING')) {
    healthStatus.status = 'DEGRADED';
  }

  res.json(healthStatus);
};

/**
 * Readiness check - is the service ready to accept traffic?
 */
export const readinessCheck = async (req: Request, res: Response) => {
  try {
    // Check database
    await sequelize.authenticate();

    res.json({
      status: 'READY',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

/**
 * Liveness check - is the service alive?
 */
export const livenessCheck = async (req: Request, res: Response) => {
  res.json({
    status: 'ALIVE',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

