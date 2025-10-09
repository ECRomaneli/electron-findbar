const { BaseWindow, BrowserWindow, WebContents, BrowserWindowConstructorOptions, Rectangle } = require('electron')

/**
 * Chrome-like findbar for Electron applications.
 */
class Findbar {
    /** @type {BaseWindow} */
    #parent

    /** @type {BrowserWindow} */
    #window

    /** @type {WebContents} */
    #findableContents

    /** @type { { active: number, total: number } } */
    #matches = { active: 0, total: 0 }

    /** @type {(findbarWindow: BrowserWindow) => void} */
    #windowHandler

    /** @type {{parentBounds: Rectangle, findbarBounds: Rectangle} => Rectangle} */
    #boundsHandler = Findbar.#setDefaultPosition

    /** @type {BrowserWindowConstructorOptions} */
    #customOptions

    /** @type {string} */
    #lastText = ''

    /** @type {boolean} */
    #matchCase = false

    /** @type {boolean} */
    #isMovable = false

    /**
     * Workaround to fix "findInPage" bug - double-click to loop
     * @type {boolean | null}
     */
    #fixMove = null

    /**
     * Configure the findbar and link to the web contents.
     * 
     * @overload
     * @param {WebContents} webContents Findable web contents. The parent window will be defined by using BaseWindow.getAllWindows() and
     * matching the webContents with the webContents of the window or its contentView children.
     * @returns {Findbar} The findbar instance if it exists.
     * @throws {Error} If no webContents is provided.
     * 
     * @overload
     * @param {BrowserWindow} browserWindow Parent window.
     * @param {WebContents} [customWebContents] Custom findable web contents. If not provided, the browserWindow.webContents will be used.
     * @returns {Findbar} The findbar instance if it exists.
     *
     * @overload
     * @param {BaseWindow} baseWindow Parent window.
     * @param {WebContents} [webContents] Custom findable web contents. If not provided, the win.contentView.children[0] will be used.
     * @returns {Findbar} The findbar instance if it exists.
     * @throws {Error} If no webContents is provided.
     */
    constructor (parent, webContents) {
        if (isFindable(parent)) {
            this.#findableContents = parent
            this.#parent = Findbar.#getBaseWindowFromWebContents(this.#findableContents)
        } else {
            this.#parent = parent
            this.#findableContents = webContents ?? Findbar.#retrieveWebContents(parent)
        }

        if (!this.#findableContents) {
            throw new Error('There are no searchable web contents.')
        }

        this.#findableContents._findbar = this

        this.#findableContents.once('destroyed', () => { this.detach() })
    }

    /**
     * Open the findbar. If the findbar is already opened, focus the input text.
     * @returns {void}
     */
    open() {
        if (this.#window) {
            this.#focusWindowAndHighlightInput()
            return
        }
        const options = Findbar.#mergeStandardOptions(this.#customOptions, this.#parent)
        this.#isMovable = options.movable
        this.#window = new BrowserWindow(options)
        this.#window.webContents._findbar = this

        this.#registerListeners()

        this.#windowHandler && this.#windowHandler(this.#window)
        this.#window.loadFile(`${__dirname}/web/findbar.html`)
    }

    /**
     * Close the findbar.
     * @returns {void}
     */
    close() {
        if (this.#window && !this.#window.isDestroyed()) {
            this.#window.close()
        }
    }

    /**
     * Detach the findbar from the web contents and close it if opened. After detaching, the findbar instance will be unusable.
     * @returns {void}
     */
    detach() {
        this.close()
        this.#findableContents._findbar = void 0
        if (this.#window) { this.#window.webContents._findbar = void 0 }
    }

    /**
     * Update the parent window of the findbar.
     * @param {BaseWindow} [newParent] - The new parent window. If not provided, the parent will be set to the window containing the web contents.
     * @returns {void}
     */
    updateParentWindow(newParent) {
        if (this.#parent === newParent) { return }
        this.close()
        this.#parent = newParent ?? Findbar.#getBaseWindowFromWebContents(this.#findableContents)
    }

    /**
     * Get the last state of the findbar.
     * @returns {{ text: string, matchCase: boolean, movable: boolean }} Last state of the findbar.
     */
    getLastState() {
        return { text: this.#lastText, matchCase: this.#matchCase, movable: this.#isMovable }
    }

    /**
     * Starts a request to find all matches for the text in the page.
     * @param {string} text - Value to find in page.
     * @param {boolean} [skipRendererEvent=false] - Skip update renderer event.
     * @returns {void}
     */
    startFind(text, skipRendererEvent) {
        skipRendererEvent || this.#window?.webContents.send('electron-findbar/text-change', text)
        if (this.#lastText = text) {
            this.isOpen() && this.#findInContent({ findNext: true })
        } else {
            this.stopFind()
        }
    }

    /**
     * Whether the search should be case-sensitive. If not set, the search will be case-insensitive.
     * @param {boolean} status - Whether the search should be case-sensitive. Default is false.
     * @param {boolean} [skipRendererEvent=false] - Skip update renderer event.
     * @returns {void}
     */
    matchCase(status, skipRendererEvent) {
        if (this.#matchCase === status) { return }
        this.#matchCase = status
        skipRendererEvent || this.#window?.webContents.send('electron-findbar/match-case-change', this.#matchCase)
        this.#stopFindInContent()
        this.startFind(this.#lastText, skipRendererEvent)
    }

    /**
     * Select previous match if any.
     * @returns {void}
     */
    findPrevious() {
        if (this.#matches.total < 2) { return }
        this.#matches.active === 1 && (this.#fixMove = false)
        this.isOpen() && this.#findInContent({ forward: false })
    }

    /**
     * Select next match if any.
     * @returns {void}
     */
    findNext() {
        if (this.#matches.total < 2) { return }
        this.#matches.active === this.#matches.total && (this.#fixMove = true)
        this.isOpen() && this.#findInContent({ forward: true })
    }

    /**
     * Stops the find request and clears selection.
     * @returns {void}
     */
    stopFind() {
        this.isOpen() && this.#sendMatchesCount(0, 0)
        this.#findableContents.isDestroyed() || this.#stopFindInContent()
    }

    /**
     * Whether the findbar is opened.
     * @returns {boolean} True if the findbar is open, otherwise false.
     */
    isOpen() {
        return !!this.#window
    }

    /**
     * Whether the findbar is focused. If the findbar is closed, false will be returned.
     * @returns {boolean} True if the findbar is focused, otherwise false.
     */
    isFocused() {
        return !!this.#window?.isFocused()
    }

    /**
     * Whether the findbar is visible to the user in the foreground of the app. 
     * If the findbar is closed, false will be returned.
     * @returns {boolean} True if the findbar is visible, otherwise false.
     */
    isVisible() {
        return !!this.#window?.isVisible()
    }

    /**
     * Provides a customized set of options to findbar window before open. Note
     * that the options below are necessary for the correct functioning and cannot
     * be overridden:
     * - options.parent (value: parentWindow)
     * - options.frame (value: false)
     * - options.transparent (value: true)
     * - options.maximizable (value: false)
     * - options.minimizable (value: false)
     * - options.skipTaskbar (value: true)
     * - options.fullscreenable (value: false)
     * - options.webPreferences.nodeIntegration (value: true)
     * - options.webPreferences.contextIsolation (value: false)
     * 
     * @param {BrowserWindowConstructorOptions} customOptions - Custom window options.
     * @returns {void}
     */
    setWindowOptions(customOptions) {
        this.#customOptions = customOptions
    }

    /**
     * Set a window handler capable of changing the findbar window settings after opening.
     * @param {(findbarWindow: BrowserWindow) => void} windowHandler - Window handler function.
     * @returns {void}
     */
    setWindowHandler(windowHandler) {
        this.#windowHandler = windowHandler
    }

    /**
     * Set a bounds handler to calculate the findbar bounds when the parent window resizes. If width and/or height are not provided, the current value will be used.
     * @param {(parentBounds: Rectangle, findbarBounds: Rectangle) => Rectangle} boundsHandler - Bounds handler function.
     * @returns {void}
     */
    setBoundsHandler(boundsHandler) {
        this.#boundsHandler = boundsHandler
    }

    #registerKeyboardShortcuts(event, input) {
        if (input.meta || input.control || input.alt) { return }

        const key = input.key.toLowerCase()

        if (input.shift) {
            if (key === 'enter') {
                this.findPrevious()
                event.preventDefault()
            }
            return;
        }

        if (key === 'enter') {
            this.findNext()
            event.preventDefault()
            return;
        }

        if (key === 'escape') {
            if (this.isOpen()) {
                this.close()
                event.preventDefault()
            }
        }
    }
    /**
     * @param {Electron.FindInPageOptions} options 
     */
    #findInContent(options) {
        options.matchCase = this.#matchCase
        this.#findableContents.findInPage(this.#lastText, options)
    }

    #stopFindInContent() {
        this.#findableContents.stopFindInPage('clearSelection')
    }

    /**
     * Register all event listeners.
     */
    #registerListeners() {
        const showCascade = () => this.#window.isVisible() || this.#window.show()
        const hideCascade = () => this.#window.isVisible() && this.#window.hide()
        const boundsHandler = () => {
            const currentBounds = this.#window.getBounds()
            const newBounds = this.#boundsHandler(this.#parent.getBounds(), currentBounds)
            if (!newBounds.width) { newBounds.width = currentBounds.width }
            if (!newBounds.height) { newBounds.height = currentBounds.height }
            this.#window.setBounds(newBounds, false)
        }
        
        if (this.#parent && !this.#parent.isDestroyed()) {
            boundsHandler()
            this.#parent.prependListener('show', showCascade)
            this.#parent.prependListener('hide', hideCascade)
            this.#parent.prependListener('resize', boundsHandler)
            this.#parent.prependListener('move', boundsHandler)
        }

        this.#window.once('closed', () => {
            if (this.#parent && !this.#parent.isDestroyed()) {
                this.#parent.off('show', showCascade)
                this.#parent.off('hide', hideCascade)
                this.#parent.off('resize', boundsHandler)
                this.#parent.off('move', boundsHandler)
            }
            this.#window = null
            this.stopFind()
        })

        this.#window.prependOnceListener('ready-to-show', () => { this.#window.show() })
        this.#window.webContents.prependListener('before-input-event', this.#registerKeyboardShortcuts.bind(this))

        this.#findableContents.prependOnceListener('destroyed', () => { this.close() })
        this.#findableContents.prependListener('found-in-page', (_e, result) => { this.#sendMatchesCount(result.activeMatchOrdinal, result.matches) })
    }

    /**
     * Send to renderer the active match and the total.
     * @param {number} active Active match.
     * @param {number} total Total matches.
     */
    #sendMatchesCount(active, total) {
        if (this.#fixMove !== null) {
            this.#fixMove ? this.findNext() : this.findPrevious()
            this.#fixMove = null
        }

        this.#matches.active = active
        this.#matches.total = total

        this.#window.webContents.send('electron-findbar/matches', this.#matches)
    }

    /**
     * Focus the findbar and highlight the input text.
     */
    #focusWindowAndHighlightInput() {
        this.#window.focus()
        this.#window.webContents.send('electron-findbar/input-focus')
    }

    /**
     * Retrieve web contents from a BrowserWindow or BaseWindow.
     * @param {BrowserWindow | BaseWindow} window 
     * @returns {WebContents | undefined} The web contents if any.
     */
    static #retrieveWebContents(window) {
        return window.webContents ?? window.contentView?.children[0]
    }

    /**
     * Get the parent window from web contents.
     * @param {WebContents} cont 
     * @returns {BaseWindow | undefined} Parent window if any.
     */
    static #getBaseWindowFromWebContents(cont) {
        return BaseWindow.getAllWindows().find(win => win.webContents === cont || win.contentView.children.some(child => child.webContents === cont))
    }

    /**
     * Set default findbar position.
     * @param {Rectangle} parentBounds 
     * @param {Rectangle} findbarBounds
     * @returns {x: number, y: number} position.
     */
    static #setDefaultPosition(parentBounds, findbarBounds) {
        return {
            x: parentBounds.x + parentBounds.width - findbarBounds.width - 20,
            y: parentBounds.y - ((findbarBounds.height / 4) | 0)
        }
    }

    /**
     * Merge custom, defaults, and fixed options.
     * @param {Electron.BrowserWindowConstructorOptions} options Custom options.
     * @param {BaseWindow | void} parent Parent window, if any.
     * @returns {Electron.BrowserWindowConstructorOptions} Merged options.
     */
    static #mergeStandardOptions(options, parent) {
        if (!options) { options = {} }
        options.width = options.width ?? 372
        options.height = options.height ?? 52
        options.resizable = options.resizable ?? false
        options.movable = options.movable ?? false
        options.acceptFirstMouse = options.acceptFirstMouse ?? true
        options.parent = parent
        options.show = false
        options.frame = false
        options.roundedCorners = true
        options.transparent = process.platform === 'linux'
        options.maximizable = false
        options.minimizable = false
        options.skipTaskbar = true
        options.fullscreenable = false
        options.autoHideMenuBar = true
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.nodeIntegration = false
        options.webPreferences.contextIsolation = true
        options.webPreferences.preload = options.webPreferences.preload ?? `${__dirname}/web/preload.js`
        return options
    }

    /**
     * Get the findbar instance for a given BrowserWindow or WebContents. 
     * If no findbar instance exists, it will return a new one linked to the web contents.
     * 
     * @overload
     * @param {WebContents} webContents Findable web contents. The parent window will be defined by using BaseWindow.getAllWindows() and
     * matching the webContents with the webContents of the window or its contentView children.
     * @returns {Findbar} The findbar instance if it exists.
     * @throws {Error} If no webContents is provided.
     * 
     * @overload
     * @param {BrowserWindow} browserWindow Parent window.
     * @param {WebContents} [customWebContents] Custom findable web contents. If not provided, the browserWindow.webContents will be used.
     * @returns {Findbar} The findbar instance if it exists.
     *
     * @overload
     * @param {BaseWindow} baseWindow Parent window.
     * @param {WebContents} [webContents] Custom findable web contents. If not provided, the win.contentView.children[0] will be used.
     * @returns {Findbar} The findbar instance if it exists.
     * @throws {Error} If no webContents is provided.
     */
     static from(windowOrWebContents, customWebContents) {
        const webContents = isFindable(windowOrWebContents) ? windowOrWebContents : customWebContents ?? Findbar.#retrieveWebContents(windowOrWebContents)
        if (!webContents) { throw new Error('[Findbar] There are no searchable web contents.') }
        return webContents._findbar || new Findbar(windowOrWebContents, customWebContents)
    }

    /**
     * Get the findbar instance for a given BrowserWindow or WebContents. 
     * @param {BrowserWindow | WebContents} windowOrWebContents
     * @returns {Findbar | undefined} The findbar instance if it exists, otherwise undefined.
     */
    static fromIfExists(windowOrWebContents) {
        const webContents = isFindable(windowOrWebContents) ? windowOrWebContents : Findbar.#retrieveWebContents(windowOrWebContents)
        if (!webContents) { throw new Error('[Findbar] There are no searchable web contents.') }
        return webContents._findbar
    }
}

const isFindable = (obj) => obj && typeof obj.findInPage === 'function' && typeof obj.stopFindInPage === 'function';

/**
 * Define IPC events.
 */
(ipc => {
    ipc.handle('electron-findbar/last-state', e => e.sender._findbar.getLastState())
    ipc.on('electron-findbar/input-change', (e, text, skip) => e.sender._findbar.startFind(text, skip))
    ipc.on('electron-findbar/match-case', (e, status, skip) => e.sender._findbar.matchCase(status, skip))
    ipc.on('electron-findbar/previous', e => e.sender._findbar.findPrevious())
    ipc.on('electron-findbar/next', e => e.sender._findbar.findNext())
    ipc.on('electron-findbar/open', e => e.sender._findbar.open())
    ipc.on('electron-findbar/close', e => {
        const findbar = e.sender._findbar
        findbar.stopFind()
        findbar.close()
    })
}) (require('electron').ipcMain)

module.exports = Findbar