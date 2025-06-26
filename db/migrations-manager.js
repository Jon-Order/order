import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MigrationsManager {
    constructor(db, isProd) {
        this.db = db;
        this.isProd = isProd;
        this.migrationsDir = path.join(__dirname, '..', 'migrations');
    }

    // Get checksum of a file's contents
    calculateChecksum(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    // Ensure migrations table exists
    async ensureMigrationsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        if (this.isProd) {
            await this.db.query(sql);
        } else {
            await this.db.run(sql);
        }
        logger.info('Ensured migrations table exists');
    }

    // Get all migration files
    async getMigrationFiles() {
        const files = await fs.promises.readdir(this.migrationsDir);
        const filteredFiles = files
            .filter(f => {
                // Filter out database-specific migrations based on environment
                if (f.includes('postgres') && !this.isProd) return false;
                if (f.includes('sqlite') && this.isProd) return false;
                if (f.includes('sqlite-to-postgres')) return false; // Skip conversion migration
                return f.endsWith('.sql');
            });
        
        // Log filtered files before sorting
        logger.info('Found migration files:', filteredFiles);
        
        const sortedFiles = filteredFiles.sort((a, b) => {
            // Extract version numbers, handling both formats: '001' and '002_0002'
            const getVersion = (filename) => {
                const match = filename.match(/^(\d+)/);
                return match ? parseInt(match[1]) : 0;
            };
            const versionA = getVersion(a);
            const versionB = getVersion(b);
            logger.info(`Comparing versions: ${a} (${versionA}) vs ${b} (${versionB})`);
            return versionA - versionB;
        });
        
        // Log sorted files
        logger.info('Sorted migration files:', sortedFiles);
        
        return sortedFiles;
    }

    // Get applied migrations from database
    async getAppliedMigrations() {
        try {
            if (this.isProd) {
                const result = await this.db.query('SELECT version, name, checksum FROM schema_migrations ORDER BY version');
                return result.rows || [];
            } else {
                const rows = await this.db.all('SELECT version, name, checksum FROM schema_migrations ORDER BY version');
                return rows || [];
            }
        } catch (error) {
            if (error.code === '42P01' || error.code === 'SQLITE_ERROR') { // Table doesn't exist
                return [];
            }
            throw error;
        }
    }

    // Record a migration as applied
    async recordMigration(version, name, checksum) {
        const sql = this.isProd
            ? 'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)'
            : 'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)';
        
        const params = [version, name, checksum];
        
        if (this.isProd) {
            await this.db.query(sql, params);
        } else {
            await this.db.run(sql, params);
        }
    }

    // Run a single migration
    async runMigration(filename) {
        const filePath = path.join(this.migrationsDir, filename);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const checksum = this.calculateChecksum(content);
        const version = parseInt(filename.split(/[-_]/)[0]);

        logger.info(`Running migration: ${filename}`);

        if (this.isProd) {
            if (typeof this.db.connect === 'function') {
                // PostgreSQL with connection pooling
                const client = await this.db.connect();
                try {
                    await client.query('BEGIN');
                    await client.query(content);
                    await this.recordMigration(version, filename, checksum);
                    await client.query('COMMIT');
                    logger.info(`Successfully applied migration: ${filename}`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    logger.error(`Failed to apply migration ${filename}:`, error);
                    throw error;
                } finally {
                    client.release();
                }
            } else {
                // PostgreSQL without connection pooling
                try {
                    await this.db.query('BEGIN');
                    await this.db.query(content);
                    await this.recordMigration(version, filename, checksum);
                    await this.db.query('COMMIT');
                    logger.info(`Successfully applied migration: ${filename}`);
                } catch (error) {
                    await this.db.query('ROLLBACK');
                    logger.error(`Failed to apply migration ${filename}:`, error);
                    throw error;
                }
            }
        } else {
            try {
                await this.db.run('BEGIN TRANSACTION');
                
                // Split the content into individual statements
                const statements = content.split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0);
                
                // Execute each statement
                for (const stmt of statements) {
                    try {
                        // Skip empty statements and comments
                        if (!stmt || stmt.startsWith('--')) continue;
                        
                        // Log the statement being executed
                        logger.info(`Executing statement: ${stmt}`);
                        await this.db.run(stmt);
                    } catch (error) {
                        logger.error(`Failed to execute statement: ${stmt}`);
                        throw error;
                    }
                }
                
                await this.recordMigration(version, filename, checksum);
                await this.db.run('COMMIT');
                logger.info(`Successfully applied migration: ${filename}`);
            } catch (error) {
                await this.db.run('ROLLBACK');
                logger.error(`Failed to apply migration ${filename}:`, error);
                throw error;
            }
        }
    }

    // Run all pending migrations
    async runMigrations() {
        await this.ensureMigrationsTable();
        
        const files = await this.getMigrationFiles();
        const appliedMigrations = await this.getAppliedMigrations();
        
        logger.info('Running migrations for ' + (this.isProd ? 'PostgreSQL' : 'SQLite'));
        logger.info('Migration files to run:', files);
        
        // Run migrations in strict sequence
        for (const file of files) {
            try {
                const version = parseInt(file.match(/^(\d+)/)[1]);
                const applied = appliedMigrations.find(m => m.version === version);
                
                // Check if all previous migrations have been applied
                const previousVersions = files
                    .filter(f => parseInt(f.match(/^(\d+)/)[1]) < version)
                    .map(f => parseInt(f.match(/^(\d+)/)[1]));
                
                const allPreviousApplied = previousVersions.every(v => 
                    appliedMigrations.some(m => m.version === v)
                );
                
                if (!allPreviousApplied) {
                    logger.info(`Skipping migration ${file} until previous migrations are applied`);
                    continue;
                }
                
                if (!applied) {
                    logger.info(`Running migration: ${file}`);
                    await this.runMigration(file);
                } else {
                    // Verify checksum of applied migration
                    const content = await fs.promises.readFile(path.join(this.migrationsDir, file), 'utf8');
                    const checksum = this.calculateChecksum(content);
                    
                    if (checksum !== applied.checksum) {
                        throw new Error(`Migration ${file} has been modified after being applied!`);
                    }
                }
            } catch (error) {
                logger.error(`Failed to run migration ${file}:`, error);
                throw error;
            }
        }
        
        // Run any skipped migrations
        const remainingFiles = files.filter(file => {
            const version = parseInt(file.match(/^(\d+)/)[1]);
            return !appliedMigrations.some(m => m.version === version);
        });
        
        if (remainingFiles.length > 0) {
            logger.info('Running remaining migrations:', remainingFiles);
            await this.runMigrations();
        }
    }
}

// Export the MigrationsManager class
export { MigrationsManager }; 