import { BaseWindow, BrowserWindow, WebContents, BrowserWindowConstructorOptions, Rectangle, ipcMain, IpcMainEvent, IpcMainInvokeEvent, FindInPageOptions, View, WebContentsView } from 'electron'

interface Matches {
  active: number
  total: number
}

interface LastState {
  text: string
  matchCase: boolean
  movable: boolean
  theme: 'light' | 'dark' | 'system'
}

interface FindableWebContents extends WebContents {
  _findbar?: Findbar
}

interface FindInPageResult {
  requestId: number
  activeMatchOrdinal: number
  matches: number
  selectionArea: Rectangle
  finalUpdate: boolean
}

type FindableWindow = BaseWindow & { webContents?: FindableWebContents } & {
  contentView: { children: { webContents: FindableWebContents }[] }
};

type FindableBrowserWindow = BrowserWindow & { webContents: FindableWebContents };

/**
 * Chrome-like findbar for Electron applications.
 */
class Findbar {
  private static defaultTheme: 'light' | 'dark' | 'system' = 'system';
  private parent?: FindableWindow;
  private window?: FindableBrowserWindow;
  private findableContents: FindableWebContents;
  private followVisibilityEventsFlag: boolean = true;
  private matches: Matches = { active: 0, total: 0 };
  private windowHandler?: (findbarWindow: BrowserWindow) => void;
  private boundsHandler: (parentBounds: Rectangle, findbarBounds: Rectangle) => Rectangle = Findbar.setDefaultPosition;
  private customOptions?: BrowserWindowConstructorOptions;
  private lastText: string = '';
  private theme?: 'light' | 'dark' | 'system';
  private matchCaseFlag: boolean = false;
  private isMovableFlag: boolean = false;
  private fixMove?: boolean;

  /**
   * Configure the findbar and link to the web contents.
   *
   * @param parent - Parent window or web contents
   * @param webContents - Custom findable web contents (optional)
   */
  constructor(parent: BaseWindow | BrowserWindow | WebContents, webContents?: WebContents) {
    if (isFindable(parent)) {
      this.findableContents = parent;
      parent = Findbar.getBaseWindowFromWebContents(this.findableContents)!;
    } else {
      this.findableContents = webContents as FindableWebContents ?? Findbar.retrieveWebContents(parent)!;
    }

    if (!this.findableContents) { throw new Error('There are no searchable web contents.');  }

    this.findableContents._findbar = this;

    this.findableContents.once('destroyed', () => { this.detach(); });
    this.updateParentWindow(parent);
  }

  /**
   * Open the findbar. If the findbar is already opened, focus the input text.
   */
  open(): void {
    if (this.window) {
      this.focusWindowAndHighlightInput();
      return;
    }
    if (!this.parent) { this.updateParentWindow(); }
    const options = Findbar.mergeStandardOptions(this.customOptions, this.parent);
    this.isMovableFlag = options.movable ?? false;
    this.window = new BrowserWindow(options) as FindableBrowserWindow;
    this.window.webContents._findbar = this;

    this.registerListeners();

    this.windowHandler?.(this.window);
    this.window.loadFile(`${__dirname}/index.html`);
  }

  /**
   * Close the findbar.
   */
  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  /**
   * Detach the findbar from the web contents and close it if opened.
   */
  detach(): void {
    this.close();
    this.findableContents._findbar = void 0;
    if (this.window) {
      this.window.webContents._findbar = void 0;
    }
  }

  /**
   * Update the parent window of the findbar.
   */
  updateParentWindow(newParent?: BaseWindow): void {
    if (this.parent === newParent) { return; }
    this.close();
    this.parent = newParent as FindableWindow ?? Findbar.getBaseWindowFromWebContents(this.findableContents);
    if (this.parent && !this.parent.isDestroyed()) {
      this.parent.once('closed', () => { this.removeParent(); });
    }
  }

  /**
   * Get the last state of the findbar.
   */
  getLastState(): LastState {
    return { text: this.lastText, matchCase: this.matchCaseFlag, movable: this.isMovableFlag, theme: this.getTheme() };
  }

  /**
   * Starts a request to find all matches for the text in the page.
   */
  startFind(text: string, skipRendererEvent?: boolean): void {
    if (!skipRendererEvent) {
      this.window?.webContents.send('electron-findbar/text-change', text);
    }
    if ((this.lastText = text)) {
      this.isOpen() && this.findInContent({ findNext: true });
    } else {
      this.stopFind();
    }
  }

  /**
   * Whether the search should be case-sensitive.
   */
  matchCase(status: boolean, skipRendererEvent?: boolean): void {
    if (this.matchCaseFlag === status) { return; }
    this.matchCaseFlag = status;
    if (!skipRendererEvent) {
      this.window?.webContents.send('electron-findbar/match-case-change', this.matchCaseFlag);
    }
    this.stopFindInContent();
    this.startFind(this.lastText, skipRendererEvent);
  }

  /**
   * Select previous match if any.
   */
  findPrevious(): void {
    if (this.matches.total < 2) { return; }
    if (this.matches.active === 1) { this.fixMove = false; }
    this.isOpen() && this.findInContent({ forward: false });
  }

  /**
   * Select next match if any.
   */
  findNext(): void {
    if (this.matches.total < 2) { return; }
    if (this.matches.active === this.matches.total) { this.fixMove = true; }
    this.isOpen() && this.findInContent({ forward: true });
  }

  /**
   * Stops the find request and clears selection.
   */
  stopFind(): void {
    this.isOpen() && this.sendMatchesCount(0, 0);
    if (!this.findableContents.isDestroyed()) {
      this.stopFindInContent();
    }
  }

  /**
   * Whether the findbar is opened.
   */
  isOpen(): boolean {
    return !!this.window;
  }

  /**
   * Whether the findbar is focused.
   */
  isFocused(): boolean {
    return !!this.window?.isFocused();
  }

  /**
   * Whether the findbar is visible to the user.
   */
  isVisible(): boolean {
    return !!this.window?.isVisible();
  }

  /**
   * Set custom options for the findbar window.
   */
  setWindowOptions(customOptions: BrowserWindowConstructorOptions): void {
    this.customOptions = customOptions;
  }

  /**
   * Set a window handler for the findbar window.
   */
  setWindowHandler(windowHandler: (findbarWindow: BrowserWindow) => void): void {
    this.windowHandler = windowHandler;
  }

  /**
   * Set a bounds handler to calculate findbar bounds.
   */
  setBoundsHandler(boundsHandler: (parentBounds: Rectangle, findbarBounds: Rectangle) => Rectangle): void {
    this.boundsHandler = boundsHandler;
  }

  /**
   * Set whether the findbar will follow the parent window "show" and "hide" events. Default is true.
   * If false, the findbar will not hide automatically with the parent window.
  */
  followVisibilityEvents(shouldFollow: boolean): void {
    this.followVisibilityEventsFlag = shouldFollow;
  }

  /**
   * Get the current theme of this findbar instance.
   * @returns The current theme setting ('light', 'dark', or 'system').
   */
  getTheme(): 'light' | 'dark' | 'system' {
    return this.theme ??= Findbar.defaultTheme;
  }

  /**
   * Update the theme of the findbar. Only affects the current instance.
   * @param theme - The theme to set. If not provided, uses the default theme.
   */
  updateTheme(theme: 'light' | 'dark' | 'system' = Findbar.defaultTheme): void {
    this.theme = theme;
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('electron-findbar/force-theme', theme);
    }
  }

  /**
   * Get the default theme.
   */
  static getDefaultTheme(): 'light' | 'dark' | 'system' {
    return Findbar.defaultTheme;
  }

  /**
   * Set the default theme for new findbar instances.
   */
  static setDefaultTheme(theme: 'light' | 'dark' | 'system'): void {
    Findbar.defaultTheme = theme;
  }
 
  private registerKeyboardShortcuts(event: any, input: any): void {
    if (input.meta || input.control || input.alt) { return; }

    const key = input.key.toLowerCase();

    if (input.shift) {
      if (key === 'enter') {
        this.findPrevious();
        event.preventDefault();
      }
      return;
    }

    if (key === 'enter') {
      this.findNext();
      event.preventDefault();
      return;
    }

    if (key === 'escape') {
      if (this.isOpen()) {
        this.close();
        event.preventDefault();
      }
    }
  }

  private removeParent(): void {
    this.close();
    this.parent = undefined;
  }

  private findInContent(options: FindInPageOptions): void {
    options.matchCase = this.matchCaseFlag;
    this.findableContents.findInPage(this.lastText, options);
  }

  private stopFindInContent(): void {
    this.findableContents.stopFindInPage('clearSelection');
  }

  private registerListeners(): void {
    const showCascade = () => { this.window!.isVisible() || this.window!.show(); };
    const hideCascade = () => { this.window!.isVisible() && this.window!.hide(); };
    const boundsHandler = () => {
      const currentBounds = this.window!.getBounds();
      const newBounds = this.boundsHandler(this.parent!.getBounds(), currentBounds);
      if (!newBounds.width) { newBounds.width = currentBounds.width; }
      if (!newBounds.height) { newBounds.height = currentBounds.height; }
      this.window!.setBounds(newBounds, false);
    }

    if (this.parent && !this.parent.isDestroyed()) {
      boundsHandler();
      if (this.followVisibilityEventsFlag) {
        this.parent.prependListener('show', showCascade);
        this.parent.prependListener('hide', hideCascade);
        // this.parent.on('restore', showCascade);
        // this.parent.on('minimize', hideCascade);
      }
      this.parent.prependListener('resize', boundsHandler);
      this.parent.prependListener('move', boundsHandler);
    }

    this.window!.once('closed', () => {
      if (this.parent && !this.parent.isDestroyed()) {
        if (this.followVisibilityEventsFlag) {
          this.parent.off('show', showCascade);
          this.parent.off('hide', hideCascade);
          // this.parent.off('restore', showCascade);
          // this.parent.off('minimize', hideCascade);
        }
        this.parent.off('resize', boundsHandler);
        this.parent.off('move', boundsHandler);
      }
      this.window = void 0;
      this.stopFind();
    })

    this.window!.prependOnceListener('ready-to-show', () => {
      this.window!.show();
    });
    this.window!.webContents.prependListener('before-input-event', (event, input) => {
      this.registerKeyboardShortcuts(event, input);
    });
    this.findableContents.prependOnceListener('destroyed', () => {
      this.close();
    });
    this.findableContents.prependListener('found-in-page', (_e, result: FindInPageResult) => {
      this.sendMatchesCount(result.activeMatchOrdinal, result.matches);
    });
  }

  private sendMatchesCount(active: number, total: number): void {
    if (this.fixMove !== void 0) {
      this.fixMove ? this.findNext() : this.findPrevious();
      this.fixMove = void 0;
    }

    this.matches.active = active;
    this.matches.total = total;

    this.window!.webContents.send('electron-findbar/matches', this.matches);
  }

  private focusWindowAndHighlightInput(): void {
    this.window!.focus();
    this.window!.webContents.send('electron-findbar/input-focus');
  }

  private static retrieveWebContents(window: BrowserWindow | BaseWindow): FindableWebContents | undefined {
    return (window as BrowserWindow).webContents ?? (window.contentView?.children[0] as WebContentsView)?.webContents;
  }

  private static getBaseWindowFromWebContents(w: WebContents): BaseWindow | undefined {
    return (BaseWindow.getAllWindows() as FindableWindow[]).find(win => {
      return win.webContents === w || win.contentView?.children.some(child => (child as WebContentsView).webContents === w);
    });
  }

  private static setDefaultPosition(parentBounds: Rectangle, findbarBounds: Rectangle): Rectangle {
    return {
      x: parentBounds.x + parentBounds.width - findbarBounds.width - 20,
      y: parentBounds.y - ((findbarBounds.height / 4) | 0),
      width: findbarBounds.width,
      height: findbarBounds.height,
    };
  }

  private static mergeStandardOptions(options?: BrowserWindowConstructorOptions, parent?: BaseWindow): BrowserWindowConstructorOptions {
    if (!options) { options = {}; }
    options.width = options.width ?? 372;
    options.height = options.height ?? 52;
    options.resizable = options.resizable ?? false;
    options.movable = options.movable ?? false;
    options.acceptFirstMouse = options.acceptFirstMouse ?? true;
    options.parent = parent;
    options.show = false;
    options.frame = false;
    options.roundedCorners = true;
    options.transparent = process.platform === 'linux';
    options.maximizable = false;
    options.minimizable = false;
    options.skipTaskbar = true;
    options.fullscreenable = false;
    options.autoHideMenuBar = true;
    if (!options.webPreferences) { options.webPreferences = {}; }
    options.webPreferences.nodeIntegration = false;
    options.webPreferences.contextIsolation = true;
    options.webPreferences.preload = options.webPreferences.preload ?? `${__dirname}/preload.js`;
    return options;
  }

  /**
   * Get the findbar instance for a given BrowserWindow or WebContents.
   */
  static from(windowOrWebContents: BaseWindow | BrowserWindow | WebContents, customWebContents?: WebContents): Findbar {
    const webContents = isFindable(windowOrWebContents) ? windowOrWebContents : customWebContents ?? Findbar.retrieveWebContents(windowOrWebContents)
    if (!webContents) { throw new Error('[Findbar] There are no searchable web contents.'); }
    return (webContents as FindableWebContents)._findbar || new Findbar(windowOrWebContents, customWebContents);
  }

  /**
   * Get the findbar instance for a given BrowserWindow or WebContents if it exists.
   */
  static fromIfExists(windowOrWebContents: BaseWindow | BrowserWindow | WebContents): Findbar | undefined {
    const webContents = isFindable(windowOrWebContents) ? windowOrWebContents : Findbar.retrieveWebContents(windowOrWebContents);
    if (!webContents) { throw new Error('[Findbar] There are no searchable web contents.'); }
    return (webContents as FindableWebContents)._findbar;
  }
}

const isFindable = (obj: any): obj is WebContents =>
  obj && typeof obj.findInPage === 'function' && typeof obj.stopFindInPage === 'function';

/**
 * Define IPC events.
 */
(() => {
  ipcMain.handle('electron-findbar/last-state', (e: IpcMainInvokeEvent) =>
    Findbar.fromIfExists(e.sender)?.getLastState()
  )
  ipcMain.on('electron-findbar/input-change', (e: IpcMainEvent, text: string, skip?: boolean) =>
    Findbar.fromIfExists(e.sender)?.startFind(text, skip)
  )
  ipcMain.on('electron-findbar/match-case', (e: IpcMainEvent, status: boolean, skip?: boolean) =>
    Findbar.fromIfExists(e.sender)?.matchCase(status, skip)
  )
  ipcMain.on('electron-findbar/previous', (e: IpcMainEvent) =>
    Findbar.fromIfExists(e.sender)?.findPrevious()
  )
  ipcMain.on('electron-findbar/next', (e: IpcMainEvent) => Findbar.fromIfExists(e.sender)?.findNext());
  ipcMain.on('electron-findbar/open', (e: IpcMainEvent) => Findbar.from(e.sender).open());
  ipcMain.on('electron-findbar/close', (e: IpcMainEvent) => {
    const findbar = Findbar.fromIfExists(e.sender);
    if (findbar) {
      findbar.stopFind();
      findbar.close();
    }
  });
})();

export = Findbar;
