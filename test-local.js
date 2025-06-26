import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function findJsFiles() {
    const files = await fs.readdir(__dirname);
    return files.filter(file => file.endsWith('.js') && file.startsWith('test-') && file !== 'test-local.js');
}

async function checkSyntax(file) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', ['--check', file]);
        let stderr = '';

        proc.stderr.on('data', (data) => {
            stderr += data;
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Syntax check failed for ${file}:\n${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

async function runTest(file) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', [file], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test_db'
            }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data;
            process.stdout.write(data);
        });

        proc.stderr.on('data', (data) => {
            stderr += data;
            process.stderr.write(data);
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Test failed for ${file}:\n${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

async function main() {
    try {
        // Find all test files
        const testFiles = await findJsFiles();
        console.log('Found test files:', testFiles);

        // Check syntax for all JS files
        console.log('\nChecking syntax...');
        const allJsFiles = await fs.readdir(__dirname);
        for (const file of allJsFiles.filter(f => f.endsWith('.js'))) {
            try {
                await checkSyntax(file);
                console.log(`✓ ${file} syntax OK`);
            } catch (error) {
                console.error(error.message);
                process.exit(1);
            }
        }

        // Run tests
        console.log('\nRunning tests...');
        for (const file of testFiles) {
            try {
                console.log(`\nRunning ${file}...`);
                await runTest(file);
                console.log(`✓ ${file} passed`);
            } catch (error) {
                console.error(error.message);
                process.exit(1);
            }
        }

        console.log('\n✨ All tests passed!');
    } catch (error) {
        console.error('Test run failed:', error);
        process.exit(1);
    }
}

main(); 