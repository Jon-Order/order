import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MonitoringService {
    constructor(db, backupDir) {
        this.db = db;
        this.backupDir = backupDir;
        this.dbPath = path.join(__dirname, 'orders.db');
        this.healthMetrics = {
            dbConnected: true,
            lastBackupTime: null,
            diskSpaceAvailable: null,
            failedOperations: 0,
            avgResponseTime: 0,
            totalRequests: 0,
            dailyStats: {
                date: new Date().toISOString().split('T')[0],
                additions: 0,
                deletions: 0,
                modifications: 0
            }
        };
        
        // Reset daily stats at midnight
        this.scheduleDailyReset();
        this.startTime = Date.now();
        this.requestTimes = [];
    }

    // Schedule daily stats reset
    scheduleDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            this.resetDailyStats();
            this.scheduleDailyReset(); // Schedule next reset
        }, timeUntilMidnight);
    }

    // Reset daily stats
    resetDailyStats() {
        this.healthMetrics.dailyStats = {
            date: new Date().toISOString().split('T')[0],
            additions: 0,
            deletions: 0,
            modifications: 0
        };
        console.log('Daily database stats reset');
    }

    // Track database changes
    trackDatabaseChange(changeType) {
        const today = new Date().toISOString().split('T')[0];
        
        // Reset stats if it's a new day
        if (this.healthMetrics.dailyStats.date !== today) {
            this.resetDailyStats();
        }
        
        switch (changeType) {
            case 'addition':
                this.healthMetrics.dailyStats.additions++;
                break;
            case 'deletion':
                this.healthMetrics.dailyStats.deletions++;
                break;
            case 'modification':
                this.healthMetrics.dailyStats.modifications++;
                break;
        }
    }

    // Check database connectivity
    async checkDatabaseConnection() {
        return new Promise((resolve) => {
            this.db.get('SELECT 1', (err) => {
                const isConnected = !err;
                this.healthMetrics.dbConnected = isConnected;
                
                if (!isConnected) {
                    console.error('Database connection lost', { error: err });
                }
                
                resolve(isConnected);
            });
        });
    }

    // Check available disk space
    checkDiskSpace() {
        try {
            const dbStats = fs.statSync(this.dbPath);
            const backupStats = fs.existsSync(this.backupDir) ? 
                fs.readdirSync(this.backupDir)
                    .map(file => fs.statSync(path.join(this.backupDir, file)).size)
                    .reduce((a, b) => a + b, 0) : 0;

            const totalSize = dbStats.size + backupStats;
            const freeDiskSpace = os.freemem();
            
            this.healthMetrics.diskSpaceAvailable = freeDiskSpace;
            
            if (freeDiskSpace < totalSize * 2) {
                console.warn('Low disk space warning', {
                    free: freeDiskSpace,
                    dbSize: dbStats.size,
                    backupsSize: backupStats
                });
            }
            
            return freeDiskSpace;
        } catch (error) {
            console.error('Error checking disk space', { error });
            return null;
        }
    }

    // Track response time
    trackResponseTime(duration) {
        this.healthMetrics.totalRequests++;
        this.healthMetrics.avgResponseTime = 
            (this.healthMetrics.avgResponseTime * (this.healthMetrics.totalRequests - 1) + duration) 
            / this.healthMetrics.totalRequests;
        this.requestTimes.push(duration);
        
        // Keep only last 1000 requests for memory efficiency
        if (this.requestTimes.length > 1000) {
            this.requestTimes.shift();
        }
    }

    // Track failed operations
    trackFailedOperation(error) {
        this.healthMetrics.failedOperations++;
        console.error('Database operation failed', { 
            error,
            totalFailures: this.healthMetrics.failedOperations
        });
    }

    // Update last backup time
    updateLastBackupTime() {
        this.healthMetrics.lastBackupTime = new Date();
    }

    // Get health metrics
    getHealthMetrics() {
        const avgResponseTime = this.requestTimes.length > 0
            ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
            : 0;

        return {
            ...this.healthMetrics,
            timestamp: new Date(),
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            avgResponseTime,
            totalRequests: this.healthMetrics.totalRequests,
            failedOperations: this.healthMetrics.failedOperations,
            lastBackupTime: this.healthMetrics.lastBackupTime,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            diskSpaceAvailable: this.checkDiskSpace()
        };
    }

    // Start monitoring
    startMonitoring(checkInterval = 60000) {
        // Initial checks
        this.checkDatabaseConnection();
        this.checkDiskSpace();

        // Set up periodic monitoring
        setInterval(async () => {
            await this.checkDatabaseConnection();
            this.checkDiskSpace();
        }, checkInterval);
    }

    // Get metrics for monitoring
    getMetrics() {
        return {
            ...this.getHealthMetrics(),
            requestStats: {
                totalRequests: this.healthMetrics.totalRequests,
                avgResponseTime: this.healthMetrics.avgResponseTime,
                recentRequests: this.requestTimes.slice(-10)
            },
            databaseStats: {
                ...this.healthMetrics.dailyStats,
                failedOperations: this.healthMetrics.failedOperations
            }
        };
    }
}

// Create a singleton instance
export const monitoring = new MonitoringService();

// Export metrics interface
export const metrics = {
    getMetrics: () => monitoring.getMetrics(),
    trackResponseTime: (duration) => monitoring.trackResponseTime(duration),
    trackFailedOperation: (error) => monitoring.trackFailedOperation(error),
    trackDatabaseChange: (changeType) => monitoring.trackDatabaseChange(changeType)
};

// Export middleware
export const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        monitoring.trackResponseTime(duration);
    });
    next();
}; 