// AI Jobs service for Stash app
// Handles background AI job tracking and UI updates

import {
  appState,
  setAIJobs,
  setAIJobIdCounter,
} from '../lib/state.js';
import { escapeHtml, getTimeAgo } from '../lib/utils.js';

const STORAGE_KEY = 'stash-ai-jobs';
const MAX_JOBS = 20;
const JOB_RETENTION_HOURS = 24;

/**
 * Load AI jobs from localStorage
 */
export function loadAIJobs() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const jobs = data.jobs || [];
      setAIJobIdCounter(data.counter || 0);

      // Convert date strings back to Date objects
      jobs.forEach((job) => {
        job.startedAt = new Date(job.startedAt);
        if (job.completedAt) job.completedAt = new Date(job.completedAt);
      });

      // Mark any "processing" jobs as failed (they were interrupted by refresh)
      jobs.forEach((job) => {
        if (job.status === 'processing' || job.status === 'pending') {
          job.status = 'failed';
          job.error = 'Interrupted by page refresh';
          job.completedAt = new Date();
        }
      });

      setAIJobs(jobs);
      saveAIJobs();
    }
  } catch (e) {
    console.warn('Failed to load AI jobs from localStorage:', e);
  }
  updateAIJobsUI();
}

/**
 * Save AI jobs to localStorage
 */
export function saveAIJobs() {
  try {
    // Only keep jobs from the last 24 hours
    const cutoff = new Date(Date.now() - JOB_RETENTION_HOURS * 60 * 60 * 1000);
    const filteredJobs = appState.aiJobs.filter(
      (job) => new Date(job.startedAt) > cutoff
    );
    setAIJobs(filteredJobs);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        jobs: appState.aiJobs.slice(0, MAX_JOBS),
        counter: appState.aiJobIdCounter,
      })
    );
  } catch (e) {
    console.warn('Failed to save AI jobs to localStorage:', e);
  }
}

/**
 * Create a new AI job
 * @param {string} title - Job title
 * @param {number} totalItems - Total items to process (default 1)
 * @returns {Object} The created job object
 */
export function createAIJob(title, totalItems = 1) {
  const newCounter = appState.aiJobIdCounter + 1;
  setAIJobIdCounter(newCounter);

  const job = {
    id: newCounter,
    title,
    status: 'pending', // pending, processing, completed, failed
    progress: 0,
    totalItems,
    completedItems: 0,
    startedAt: new Date(),
    completedAt: null,
    error: null,
  };

  setAIJobs([job, ...appState.aiJobs]);
  saveAIJobs();
  updateAIJobsUI();

  return job;
}

/**
 * Update an existing AI job
 * @param {number} jobId - Job ID
 * @param {Object} updates - Properties to update
 * @returns {Object|undefined} The updated job
 */
export function updateAIJob(jobId, updates) {
  const job = appState.aiJobs.find((j) => j.id === jobId);
  if (job) {
    Object.assign(job, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      job.completedAt = new Date();
    }
    saveAIJobs();
    updateAIJobsUI();
    renderAIJobsList();
  }
  return job;
}

/**
 * Update the AI jobs UI (spinner and count badge)
 */
export function updateAIJobsUI() {
  const btn = document.getElementById('ai-jobs-btn');
  const spinner = btn?.querySelector('.ai-jobs-spinner');
  const countBadge = document.getElementById('ai-jobs-count');

  const activeJobs = appState.aiJobs.filter(
    (j) => j.status === 'pending' || j.status === 'processing'
  );
  const hasActiveJobs = activeJobs.length > 0;

  if (spinner) {
    spinner.classList.toggle('hidden', !hasActiveJobs);
  }
  if (countBadge) {
    countBadge.textContent = activeJobs.length;
    countBadge.classList.toggle('hidden', activeJobs.length === 0);
  }
}

/**
 * Render the AI jobs list in the modal
 */
export function renderAIJobsList() {
  const container = document.getElementById('ai-jobs-list');
  if (!container) return;

  // Keep only last 20 jobs
  if (appState.aiJobs.length > MAX_JOBS) {
    setAIJobs(appState.aiJobs.slice(0, MAX_JOBS));
  }

  if (appState.aiJobs.length === 0) {
    container.innerHTML = `
      <div class="ai-jobs-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        <p>No AI jobs</p>
        <span>Background AI processing tasks will appear here</span>
      </div>
    `;
    return;
  }

  container.innerHTML = appState.aiJobs
    .map((job) => {
      const statusClass = job.status;
      const progressPercent =
        job.totalItems > 1
          ? Math.round((job.completedItems / job.totalItems) * 100)
          : job.status === 'completed'
            ? 100
            : job.status === 'processing'
              ? 50
              : 0;

      let statusText = '';
      if (job.status === 'pending') statusText = 'Queued';
      else if (job.status === 'processing')
        statusText = `Processing${job.totalItems > 1 ? ` (${job.completedItems}/${job.totalItems})` : '...'}`;
      else if (job.status === 'completed') statusText = 'Completed';
      else if (job.status === 'failed') statusText = job.error || 'Failed';

      const timeAgo = getTimeAgo(job.completedAt || job.startedAt);

      return `
      <div class="ai-job-item ${statusClass}">
        <div class="ai-job-header">
          <span class="ai-job-title">${escapeHtml(job.title)}</span>
          <span class="ai-job-time">${timeAgo}</span>
        </div>
        <div class="ai-job-status">
          ${job.status === 'processing' ? '<div class="ai-job-spinner"></div>' : ''}
          <span>${statusText}</span>
        </div>
        ${
          job.status === 'processing' && job.totalItems > 1
            ? `
          <div class="ai-job-progress">
            <div class="ai-job-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
        `
            : ''
        }
      </div>
    `;
    })
    .join('');
}

/**
 * Get active (pending/processing) jobs
 * @returns {Array}
 */
export function getActiveJobs() {
  return appState.aiJobs.filter(
    (j) => j.status === 'pending' || j.status === 'processing'
  );
}

/**
 * Get all jobs
 * @returns {Array}
 */
export function getAIJobs() {
  return appState.aiJobs;
}
