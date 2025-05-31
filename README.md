<p align='center'>
    <a href="https://github.com/ECRomaneli/electron-findbar" style='text-decoration:none'><img src="https://i.postimg.cc/sXwqJP59/findbar-v2-light.png" alt='Findbar Light Theme'><img src="https://i.postimg.cc/j26XXRVV/findbar-v2-dark.png" alt='Findbar Dark Theme'></a>
</p>
<p align='center'>
    Chrome-like findbar for your Electron application
</p>
<p align='center'>
    <a href="https://github.com/ECRomaneli/electron-findbar/tags"><img src="https://img.shields.io/github/v/tag/ecromaneli/electron-findbar?label=version&sort=semver&style=for-the-badge" alt="Version"></a>
    <a href="https://github.com/ECRomaneli/electron-findbar/commits/master"><img src="https://img.shields.io/github/last-commit/ecromaneli/electron-findbar?style=for-the-badge" alt="Last Commit"></a>
    <a href="https://github.com/ECRomaneli/electron-findbar/blob/master/LICENSE"><img src="https://img.shields.io/github/license/ecromaneli/electron-findbar?style=for-the-badge" alt="License"></a>
    <a href="https://github.com/ECRomaneli/electron-findbar/issues"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=for-the-badge" alt="Contributions Welcome"></a>
</p>

## Installation

Install the `electron-findbar` package via npm:

```sh
npm install electron-findbar
```

## Overview

The `electron-findbar` is a `BrowserWindow` component designed to emulate the Chrome findbar layout, leveraging the `webContents.findInPage` method to navigate through matches. Inter-process communication (IPC) is used for interaction between the `main` and `renderer` processes.

### Memory Usage

To optimize memory usage, the Findbar window is created only when the findbar is open. The implementation is lightweight, including only essential code.

## Usage

All public methods are documented with JSDoc and can be referenced during import.

### Importing the Findbar

To import the Findbar class:

```js
const Findbar = require('electron-findbar')
```

### Creating the Findbar Instance

You can pass a `BrowserWindow` instance as a single parameter to use it as the parent window. The `BrowserWindow.WebContents` will be used as the findable content:

```js
// Create or retrieve the findbar associated to the browserWindow.webContents. If a new findbar is created, the browserWindow is used as parent.
const findbar = Findbar.from(browserWindow)
```

Alternatively, you can provide a custom `WebContents` as the second parameter. In this case, the first parameter can be any `BaseWindow`, and the second parameter will be the findable content:

```js
// Create or retrieve the findbar associated to the webContents. If a new findbar is created, the baseWindow is used as parent.
const findbar = Findbar.from(baseWindow, webContents)
```

Is also possible to create a findbar without a parent window (even though it is not recommended):

```js
// Create or retrieve the findbar associated to the webContents. If a new findbar is created, it will be displayed in the middle of the screen without a parent to connect to.
const findbar = Findbar.from(webContents)
```

**Note:** The findbar is ALWAYS linked to the webContents not the window. The parent is only the window to connect the events and stay on top. If the `.from(webContents)` is used to retrieve an existing findbar previously created with a parent, the findbar will stay connected to the parent.

#### Retrieve if exists

If there is no intention to create a new findbar in case it does not exist, use:

```js
// Get the existing findbar or undefined.
const existingFindbar = Findbar.fromIfExists(browserWindow)
/* OR */
const existingFindbar = Findbar.fromIfExists(webContents)
```

### Configuring the Findbar

You can customize the Findbar window options using the `setWindowOptions` method:

```js
findbar.setWindowOptions({ resizable: true, alwaysOnTop: true, height: 100 })
```

To handle the Findbar window directly after it is opened, use the `setWindowHandler` method:

```js
findbar.setWindowHandler(win => {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
});
```

The findbar has a default position handler which moves the findbar to the top-right corner. To change the position handler, use the `setBoundsHandler` method. The bounds handler is called when the parent window moves or resizes and provides both the parent and findbar bounds as parameters.

```js
findbar.setBoundsHandler((parentBounds, findbarBounds) => ({
    x: parentBounds.x + parentBounds.width - findbarBounds.width - 20,
    y: parentBounds.y - ((findbarBounds.height / 4) | 0)
    /* width: OPTIONAL, current value will be used */
    /* height: OPTIONAL, current value will be used */
}))
```

### Opening the Findbar

The Findbar is a child window of the `BaseWindow` passed during construction. To open it use:

```js
findbar.open()
```

### Closing the Findbar

When the Findbar is closed, its window is destroyed to free memory resources. Use the following method to close the Findbar:

```js
findbar.close()
```

A new internal window will be created the next time the `open` method is called. There is no need to instantiate another Findbar for the same parent window.

### Quick Example

Here is a quick example demonstrating how to use the `electron-findbar`:

```js
const { app, BrowserWindow } = require('electron')
const Findbar = require('electron-findbar')

app.whenReady().then(() => {  
  const window = new BrowserWindow()
  window.loadURL('https://github.com/ECRomaneli/electron-findbar')

  // Create and configure the Findbar object
  const findbar = Findbar.from(window)

  // [OPTIONAL] Customize window options
  findbar.setWindowOptions({ movable: true, resizable: true })

  // [OPTIONAL] Handle the window object when the Findbar is opened
  findbar.setWindowHandler(win => { win.webContents.openDevTools() })

  // Open the Findbar
  findbar.open()
})
```

### Configuring Keyboard Shortcuts

The Findbar component can be controlled using keyboard shortcuts. Below are two implementation approaches to help you integrate search functionality seamlessly into your application's user experience.

**Note:** The following examples demonstrate only the ideal (happy path) scenarios. For production use, make sure to thoroughly validate all inputs and handle edge cases appropriately.

#### Using Before Input Event

The `before-input-event` approach allows you to capture keyboard events directly in the main process before they're processed by the web contents, giving you precise control:

```js
window.webContents.on('before-input-event', (event, input) => {
  // Detect Ctrl+F (Windows/Linux) or Command+F (macOS)
  if ((input.control || input.meta) && input.key.toLowerCase() === 'f') {
    // Prevent default browser behavior
    event.preventDefault()
    
    // Access and open the findbar
    const findbar = Findbar.from(window)
    if (findbar) {
      findbar.open()
    }
  }
  
  // Handle Escape key to close the findbar
  if (input.key === 'Escape') {
    const findbar = Findbar.from(window)
    if (findbar && findbar.isOpen()) {
      event.preventDefault()
      findbar.close()
    }
  }
})
```

#### Using Menu Accelerators

For a more integrated approach, you can modify your application's menu system to include findbar controls with keyboard accelerators. This method makes shortcuts available throughout your application:

```js
// Get reference to the parent window
const parent = currentBrowserWindowOrWebContents

// Get or create application menu
const appMenu = Menu.getApplicationMenu() ?? new Menu()

// Add Findbar controls to menu
appMenu.append(new MenuItem({
  label: 'Find', 
  submenu: [
    { 
      label: 'Find in Page', 
      click: () => Findbar.from(parent)?.open(), 
      accelerator: 'CommandOrControl+F' 
    },
    { 
      label: 'Close Find', 
      click: () => Findbar.from(parent)?.close(), 
      accelerator: 'Esc' 
    }
  ]
}))

// Apply the updated menu
Menu.setApplicationMenu(appMenu)
```

Both approaches have their advantages - the first offers fine-grained control over exactly when shortcuts are activated, while the second provides better integration with standard application menu conventions.

### Finding Text using the main process

Once open, the Findbar appears by default in the top-right corner of the parent window and can be used without additional coding. Alternatively, you can use the following methods to trigger `findInPage` and navigate through matches in the main process:

```js
/**
 * Get the last state of the findbar.
 * @returns {{ text: string, matchCase: boolean, movable: boolean }} Last state of the findbar.
 */
getLastState()

/**
 * Initiate a request to find all matches for the specified text on the page.
 * @param {string} text - The text to search for.
 * @param {boolean} [skipRendererEvent=false] - Skip update renderer event.
 */
startFind(text, skipRendererEvent)

/**
 * Whether the search should be case-sensitive.
 * @param {boolean} status - Whether the search should be case-sensitive. Default is false.
 * @param {boolean} [skipRendererEvent=false] - Skip update renderer event.
 */
matchCase(status, skipRendererEvent)

/**
 * Select the previous match, if available.
 */
findPrevious()

/**
 * Select the next match, if available.
 */
findNext()

/**
 * Stop the find request and clears selection.
 */
stopFind()

/**
 * Whether the findbar is opened.
 * @returns {boolean} True if the findbar is open, otherwise false.
 */
isOpen()

/**
 * Whether the findbar is focused. If the findbar is closed, false will be returned.
 * @returns {boolean} True if the findbar is focused, otherwise false.
 */
isFocused()

/**
 * Whether the findbar is visible to the user in the foreground of the app.
 * If the findbar is closed, false will be returned.
 * @returns {boolean} True if the findbar is visible, otherwise false.
 */
isVisible()
```

## IPC Events

As an alternative, the findbar can be controlled using IPC events in the `renderer` process of the `WebContents` provided during the findbar construction.

### ipcRenderer

If the `contextIsolation` is enabled, the `electron-findbar/remote` will not be available, but the IPC events can be used directly through the preload script:

```js
const $remote = (ipc => ({
    getLastState: async () => ipc.invoke('electron-findbar/last-state'),
    inputChange: (value) => { ipc.send('electron-findbar/input-change', value) },
    matchCase: (value) => { ipc.send('electron-findbar/match-case', value) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    close: () => { ipc.send('electron-findbar/close') }
})) (require('electron').ipcRenderer)

$remote.open()
$remote.inputChange('findIt')
```

### Remote module

With the `contextIsolation` disabled, the remote library is available to use:

```js
const FindbarRemote = require('electron-findbar/remote')

FindbarRemote.open()
FindbarRemote.inputChange('findIt')
```

## Author

Created by [Emerson Capuchi Romaneli](https://github.com/ECRomaneli) (@ECRomaneli).

## License

This project is licensed under the [MIT License](https://github.com/ECRomaneli/electron-findbar/blob/master/LICENSE).

