import type { Database } from '../db/database.js';
import { JobSourceService } from './jobSourceService.js';

export class JobDiscoveryScheduler {
  private static instance: JobDiscoveryScheduler | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private jobSource: JobSourceService;

  constructor(private readonly db: Database) {
    this.jobSource = new JobSourceService(db);
  }

  static getInstance(db: Database): JobDiscoveryScheduler {
    if (!JobDiscoveryScheduler.instance) {
      JobDiscoveryScheduler.instance = new JobDiscoveryScheduler(db);
    }
    return JobDiscoveryScheduler.instance;
  }

  start(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Check every 60 seconds if a scheduled sync is due
    this.timer = setInterval(() => {
      void this.checkAndRunScheduledSync();
    }, 60_000);

    // Compute initial next sync time if not set
    const config = this.db.getJobDiscoveryConfig();
    const intervalHours = config.autoDiscoveryIntervalHours || 6;
    const lastRunMs = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
    const nowMs = Date.now();
    const intervalMs = intervalHours * 3600 * 1000;

    if (!config.lastRunAt || nowMs - lastRunMs >= intervalMs) {
      // First boot or overdue: schedule shortly
      setTimeout(() => {
        void this.runSync('startup');
      }, 5000);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkAndRunScheduledSync(): Promise<void> {
    if (this.isSyncing) return;

    const config = this.db.getJobDiscoveryConfig();
    const intervalHours = config.autoDiscoveryIntervalHours || 6;
    const lastRunMs = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
    const nowMs = Date.now();
    const intervalMs = intervalHours * 3600 * 1000;

    if (nowMs - lastRunMs >= intervalMs) {
      await this.runSync('scheduled');
    }
  }

  async runSync(triggerType: 'manual' | 'scheduled' | 'startup' = 'manual'): Promise<{
    totalFetched: number;
    newSaved: number;
    duplicatesSkipped: number;
    sourcesChecked: string[];
    sourcesFailed: string[];
  }> {
    if (this.isSyncing) {
      throw new Error('A job synchronization is already in progress. Please wait for it to complete.');
    }

    this.isSyncing = true;
    try {
      const config = this.db.getJobDiscoveryConfig();
      const result = await this.jobSource.syncJobsFromAllSources(config.preferredCountries);

      if (result.newSaved > 0) {
        this.db.addJobNotification({
          type: 'new_match',
          title: `${result.newSaved} New Opportunities Discovered`,
          message: `Discovered and verified ${result.newSaved} new matching vacancies across ${result.sourcesChecked.join(', ')}.`,
        });
      }

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  getStatus() {
    const status = this.db.getLatestJobSyncStatus();
    return {
      ...status,
      isSyncing: this.isSyncing,
    };
  }
}
