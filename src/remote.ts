import { ipcRenderer, IpcRendererEvent } from 'electron'

/**
 * Remote IPC events to control the findbar through the renderer.
 */
interface Remote {
  /**
   * Get last queried text and the "match case" status.
   */
  getLastState(): Promise<{ text: string; matchCase: boolean; movable: boolean }>;

  /**
   * Change the input value and find it.
   * @param text - The text to search for
   */
  inputChange(text: string): void;

  /**
   * Toggle case sensitive search
   * @param value - Whether to match case or not
   */
  matchCase(value: boolean): void;

  /**
   * Navigate to the previous match
   */
  previous(): void;

  /**
   * Navigate to the next match
   */
  next(): void;

  /**
   * Open the findbar
   */
  open(): void;

  /**
   * Close the findbar
   */
  close(): void;

  /**
   * Listen for matches change event
   */
  onMatchesChange(listener: (event: IpcRendererEvent, matches: { active: number; total: number }) => void): void;

  /**
   * Listen for input focus event
   */
  onInputFocus(listener: (event: IpcRendererEvent) => void): void;

  /**
   * Listen for text change event
   */
  onTextChange(listener: (event: IpcRendererEvent, text: string) => void): void;

  /**
   * Listen for match case change event
   */
  onMatchCaseChange(listener: (event: IpcRendererEvent, status: boolean) => void): void;
}

const Remote: Remote = {
  getLastState: async () => ipcRenderer.invoke('electron-findbar/last-state'),
  inputChange: (text: string) => {
    ipcRenderer.send('electron-findbar/input-change', text);
  },
  matchCase: (value: boolean) => {
    ipcRenderer.send('electron-findbar/match-case', value);
  },
  previous: () => {
    ipcRenderer.send('electron-findbar/previous');
  },
  next: () => {
    ipcRenderer.send('electron-findbar/next');
  },
  open: () => {
    ipcRenderer.send('electron-findbar/open');
  },
  close: () => {
    ipcRenderer.send('electron-findbar/close');
  },
  onMatchesChange: (listener) => {
    ipcRenderer.on('electron-findbar/matches', listener);
  },
  onInputFocus: (listener) => {
    ipcRenderer.on('electron-findbar/input-focus', listener);
  },
  onTextChange: (listener) => {
    ipcRenderer.on('electron-findbar/text-change', listener);
  },
  onMatchCaseChange: (listener) => {
    ipcRenderer.on('electron-findbar/match-case-change', listener);
  },
};

export = Remote;
