const { BaseWindow, BrowserWindow, WebContents, BrowserWindowConstructorOptions, Rectangle } = require('electron')

class Findbar {
    /** @type {BaseWindow} */
    #parent

    /** @type {BrowserWindow} */
    #window

    /** @type {WebContents} */
    #searchableContents

    /** */
    #matches

    /** @type {(findbarWindow: BrowserWindow) => void} */
    #windowHandler

    /** @type {BrowserWindowConstructorOptions} */
    #customOptions

    /** @type {string} */
    #lastText = ''

    /** @type {boolean} */
    #followParent = process.platform !== 'darwin'

    /**
     * Workaround to fix "findInPage" bug - double-click to loop
     * @type {boolean | null}
     */
    #fixMove = null

    /**
     * Prepare the findbar.
     * @param {BaseWindow} parent Parent window.
     * @param {WebContents | void} webContents Searchable web contents. If not set and the parent is a BrowserWindow, 
     * the web contents of the parent will be used. Otherwise, an error will be triggered.
     */
    constructor (parent, webContents) {
        this.#parent = parent
        this.#searchableContents = webContents ?? parent.webContents
        
        if (!this.#searchableContents) {
            throw new Error('There are no searchable web contents.')
        }
    }
    
    /**
     * Open the findbar. If the findbar is already opened, focus the input text.
     */
    open() {
        if (this.#window) {
            this.#focusWindowAndHighlightInput()
            return
        }
        this.#window = new BrowserWindow(Findbar.#mergeStandardOptions(this.#customOptions, this.#parent))
        this.#window.webContents.findbar = this

        this.#registerListeners()
        this.#setDefaultPosition(this.#parent.getBounds())

        this.#windowHandler && this.#windowHandler(this.#window)
        
        this.#window.loadFile(`${__dirname}/web/findbar.html`)
    }

    /**
     * Close the findbar.
     */
    close() {
        this.#window?.close()
    }

    /**
     * Get last queried text.
     */
    getLastText() {
        return this.#lastText
    }

    /**
     * Starts a request to find all matches for the text in the page.
     * @param {string} text Value to find in page.
     * @param {boolean | void} skipInputUpdate Skip findbar input update.
     */
    startFind(text, skipInputUpdate) {
        skipInputUpdate || this.#window?.webContents.send('electron-findbar/text-change', text)
        if (this.#lastText = text) {
            this.#searchableContents.findInPage(this.#lastText, { findNext: true })
        } else {
            this.stopFind()
        }
    }

    /**
     * Select previous match if any.
     */
    findPrevious() {
        if (this.#matches.active === 1) {
            this.#fixMove = false
        }

        this.#searchableContents.findInPage(this.#lastText, { forward: false })
    }

    /**
     * Select next match if any.
     */
    findNext() {
        if (this.#matches.active === this.#matches.total) {
            this.#fixMove = true
        }

        this.#searchableContents.findInPage(this.#lastText, { forward: true })
    }

    /**
     * Stops the find request.
     */
    stopFind() {
        this.isOpen() && this.#sendMatchesCount(0, 0)
        this.#searchableContents.isDestroyed() || this.#searchableContents.stopFindInPage("clearSelection")
    }

    /**
     * Return if the findbar is open or not.
     * @returns {boolean} True, if the findbar is open. Otherwise, false.
     */
    isOpen() {
        return !!this.#window
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
     * @param {BrowserWindowConstructorOptions} customOptions Custom window options.
     */
    setWindowOptions(customOptions) {
        this.#customOptions = customOptions
    }

    /**
     * Set a window handler capable of changing the findbar window settings after opening.
     * @param {(findbarWindow: BrowserWindow) => void} windowHandler Window handler.
     */
    setWindowHandler(windowHandler) {
        this.#windowHandler = windowHandler
    }

    /**
     * Set the findbar to follow the parent window. Default is true.
     * 
     * On darwin platform, the findbar follows the parent window by default. This method is set
     * to false to not create a "move" event listener unnescessarily.
     * @platform win32,linux
     * @param {boolean} follow If true, the findbar will follow the parent window movement.
     */
    followParentWindow(follow) {
        this.#followParent = follow
    }

    /**
     * Register all event listeners.
     */
    #registerListeners() {
        const followParent = this.#followParent
        const showCascade = () => this.#window.isVisible() || this.#window.show()
        const hideCascade = () => this.#window.isVisible() && this.#window.hide()
        
        let lastPos = this.#parent.getPosition()
        const moveCascade = () => {
            const newPos = this.#parent.getPosition()
            const diff = { x: newPos[0] - lastPos[0], y: newPos[1] - lastPos[1] }
            lastPos = newPos

            const { x, y } = this.#window.getBounds()
            this.#window.setPosition(x + diff.x, y + diff.y)
        }

        this.#parent.prependListener('show', showCascade)
        this.#parent.prependListener('hide', hideCascade)
        followParent && this.#parent.prependListener('move', moveCascade)

        this.#window.once('close', () => {
            this.#parent.off('show', showCascade)
            this.#parent.off('hide', hideCascade)
            followParent && this.#parent.off('move', moveCascade)
            this.#window = null
            this.stopFind()
        })

        this.#searchableContents.prependOnceListener('destroyed', () => { this.close() })
        this.#searchableContents.prependListener('found-in-page', (_e, result) => { this.#sendMatchesCount(result.activeMatchOrdinal, result.matches) })
    }

    /**
     * Set default findbar position.
     * @param {Rectangle} parentBounds 
     */
    #setDefaultPosition(parentBounds) {
        const s = this.#window.getSize()
        this.#window.setBounds({
            x: parentBounds.x + parentBounds.width - s[0] - 20,
            y: parentBounds.y - ((s[1] / 4) | 0)
        })
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

        this.#matches = { active, total }

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
        options.frame = false
        options.transparent = true
        options.maximizable = false
        options.minimizable = false
        options.skipTaskbar = true
        options.fullscreenable = false
        if (!options.webPreferences) { options.webPreferences = {} }
        options.webPreferences.nodeIntegration = true
        options.webPreferences.contextIsolation = false
        return options
    }
}

/**
 * Define IPC events.
 */
(({ ipcMain }) => {
    ipcMain.handle('electron-findbar/last-text', e => e.sender.findbar.getLastText())
    ipcMain.on('electron-findbar/input-change', (e, text) => e.sender.findbar.startFind(text, true))
    ipcMain.on('electron-findbar/previous', e => e.sender.findbar.findPrevious())
    ipcMain.on('electron-findbar/next', e => e.sender.findbar.findNext())
    ipcMain.on('electron-findbar/close', e => {
        const findbar = e.sender.findbar
        findbar.stopFind()
        findbar.close()
    })
}) (require('electron'))

module.exports = { Findbar }