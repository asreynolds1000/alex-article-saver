// Centralized state management for Stash app
// All modules import appState to access shared state

export const appState = {
  // Core state
  supabase: null,
  user: null,
  currentView: 'all',
  currentSave: null,
  currentTagFilter: null, // { id, name } of active tag filter

  // Data arrays
  saves: [],
  tags: [],
  folders: [],

  // Staging data for imports
  pendingKindleImport: null,
  pendingApplePodcasts: null,

  // Audio player state
  audio: null,
  isPlaying: false,

  // AI job queue
  aiJobs: [],
  aiJobIdCounter: 0,

  // Allowed emails for access control
  allowedEmails: ['a@alexreynolds.com'],
};

// State setters for controlled updates
export function setSupabase(client) {
  appState.supabase = client;
}

export function setUser(user) {
  appState.user = user;
}

export function setCurrentView(view) {
  appState.currentView = view;
}

export function setCurrentSave(save) {
  appState.currentSave = save;
}

export function setSaves(saves) {
  appState.saves = saves;
}

export function setTags(tags) {
  appState.tags = tags;
}

export function setFolders(folders) {
  appState.folders = folders;
}

export function setCurrentTagFilter(tagFilter) {
  appState.currentTagFilter = tagFilter;
}

export function setPendingKindleImport(data) {
  appState.pendingKindleImport = data;
}

export function setAudio(audio) {
  appState.audio = audio;
}

export function setIsPlaying(isPlaying) {
  appState.isPlaying = isPlaying;
}

export function setAIJobs(jobs) {
  appState.aiJobs = jobs;
}

export function setAIJobIdCounter(counter) {
  appState.aiJobIdCounter = counter;
}
