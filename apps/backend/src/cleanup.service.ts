import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  // Define directories to clean
  private getDirectoriesToClean(): string[] {
    const rootDir = process.cwd();
    return [
      path.join(rootDir, 'storage'),
      path.join(rootDir, 'uploads'),
      path.join(rootDir, 'temp'),
    ];
  }

  // Define temp patterns in the root directory (like temp-chrome-xyz)
  private getRootTempDirectories(): string[] {
    return [process.cwd()];
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  handleCron() {
    this.logger.log('Starting scheduled cleanup of dump and uploaded files...');

    const expirationTimeMs = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    // Clean specific directories (storage, uploads, temp)
    const dirs = this.getDirectoriesToClean();
    for (const dir of dirs) {
      this.cleanDirectory(dir, now, expirationTimeMs);
    }

    // Clean temp-chrome-* directories in root
    const rootDirs = this.getRootTempDirectories();
    for (const rootDir of rootDirs) {
      if (fs.existsSync(rootDir)) {
        try {
          const files = fs.readdirSync(rootDir);
          for (const file of files) {
            if (file.startsWith('temp-chrome-') || file.startsWith('puppeteer_dev_chrome_profile-')) {
              const fullPath = path.join(rootDir, file);
              this.deleteDirectoryIfOld(fullPath, now, expirationTimeMs);
            }
          }
        } catch (err) {
          this.logger.error(`Error reading root directory ${rootDir} for temp files`, err);
        }
      }
    }

    this.logger.log('Cleanup finished.');
  }

  private cleanDirectory(dir: string, now: number, expirationTimeMs: number) {
    if (!fs.existsSync(dir)) {
      return;
    }

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        const age = now - stat.mtimeMs;
        if (age > expirationTimeMs) {
          if (stat.isFile()) {
            fs.unlinkSync(fullPath);
            this.logger.log(`Deleted old file: ${fullPath}`);
          } else if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            this.logger.log(`Deleted old directory: ${fullPath}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error cleaning directory ${dir}`, err);
    }
  }

  private deleteDirectoryIfOld(dir: string, now: number, expirationTimeMs: number) {
    try {
      const stat = fs.statSync(dir);
      const age = now - stat.mtimeMs;
      if (age > expirationTimeMs && stat.isDirectory()) {
        fs.rmSync(dir, { recursive: true, force: true });
        this.logger.log(`Deleted old temp directory: ${dir}`);
      }
    } catch (err) {
      this.logger.error(`Error checking/deleting temp directory ${dir}`, err);
    }
  }
}
