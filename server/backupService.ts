import fs from "fs";
import path from "path";
import { recordAuditLog } from "./security.js";

// Ensure backup folder directories exist
const BACKUPS_DIR = path.join(process.cwd(), "server", "data", "backups");
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export interface BackupRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  timestamp: string;
}

/**
 * Creates a secure dated copy of the local JSON database to disk.
 * Limits the historical retention count to the latest 10 items.
 */
export function executeDurableBackup(): BackupRecord {
  const dbSourcePath = path.join(process.cwd(), "server", "data", "db.json");
  if (!fs.existsSync(dbSourcePath)) {
    throw new Error(`Primary database storage file 'db.json' not found at expected path: ${dbSourcePath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `db_backup_${timestamp}.json`;
  const dbDestPath = path.join(BACKUPS_DIR, backupFileName);

  // Copy db.json dynamically
  fs.copyFileSync(dbSourcePath, dbDestPath);

  const stats = fs.statSync(dbDestPath);
  const backupObj: BackupRecord = {
    id: "backup-" + Math.random().toString(36).substring(3, 8),
    fileName: backupFileName,
    sizeBytes: stats.size,
    timestamp: new Date().toISOString()
  };

  recordAuditLog({
    userId: "system-backup-runner",
    userEmail: "backup-daemon@tenderai.in",
    action: "DATABASE_BACKUP_CREATED",
    description: `Created durable system state backup '${backupFileName}' (Size: ${(stats.size / 1024).toFixed(2)} KB)`,
    status: "SUCCESS"
  });

  // Prune older backups, keeping only the 10 most recent
  pruneExcessBackups();

  return backupObj;
}

/**
 * Lists all existing dated backup files
 */
export function getBackupHistory(): BackupRecord[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];

  const files = fs.readdirSync(BACKUPS_DIR);
  return files
    .filter((f) => f.startsWith("db_backup_") && f.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(BACKUPS_DIR, fileName);
      const stats = fs.statSync(filePath);
      return {
        id: "backup-" + fileName.replace(/[^0-9-]/g, "").substring(0, 8),
        fileName,
        sizeBytes: stats.size,
        timestamp: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Deletes backup files beyond the retention ceiling (10 latest items)
 */
function pruneExcessBackups() {
  const history = getBackupHistory();
  if (history.length <= 10) return;

  const toDelete = history.slice(10);
  for (const record of toDelete) {
    const filePath = path.join(BACKUPS_DIR, record.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[BACKUP] Pruned expired historical retention backup file: ${record.fileName}`);
    }
  }
}
