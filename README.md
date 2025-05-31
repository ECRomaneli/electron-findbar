<p align='center'>
    <a href="https://github.com/ECRomaneli/handbook" style='text-decoration:none'>
        <img src="https://i.postimg.cc/0QR0s0Z1/findbar-light.png" alt='Findbar Light Theme'>
        <img src="https://i.postimg.cc/LXtB6g0Y/findbar-dark.png" alt='Findbar Dark Theme'>
    </a>
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
const findbar = new Findbar(browserWindow)
```

Alternatively, you can provide a custom `WebContents` as the second parameter. In this case, the first parameter can be any `BaseWindow`, and the second parameter will be the findable content:

```js
const findbar = new Findbar(baseWindow, customWebContents)
```

### Configuring the Findbar

You can customize the Findbar window options using the `setWindowOptions` method:

```js
findbar.setWindowOptions({ movable: true, resizable: true, alwaysOnTop: true })
```

To handle the Findbar window directly after it is opened, use the `setWindowHandler` method:

```js
findbar.setWindowHandler(win => {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
});
```

The findbar has a default position handler which moves the findbar to the top-right corner. To change the position handler, use the `setPositionHandler` method. The position handler is called when the parent window moves or resizes and provides both the parent and findbar bounds as parameters.

```js
findbar.setPositionHandler((parentBounds, findbarBounds) => ({
    x: parentBounds.x + parentBounds.width - findbarBounds.width - 20,
    y: parentBounds.y - ((findbarBounds.height / 4) | 0)
}))
```

### Opening the Findbar

The Findbar is a child window of the `BaseWindow` passed during construction. To open it use:

```js
findbar.open()
```

### Finding Text in the Page

Once open, the Findbar appears by default in the top-right corner of the parent window and can be used without additional coding. Alternatively, you can use the following methods to trigger `findInPage` and navigate through matches in the main process:

```js
/**
 * Retrieve the last queried value.
 */
getLastValue()

/**
 * Initiate a request to find all matches for the specified text on the page.
 * @param {string} text - The text to search for.
 */
startFind(text)

/**
 * Select the previous match, if available.
 */
findPrevious()

/**
 * Select the next match, if available.
 */
findNext()

/**
 * Stop the find request.
 */
stopFind()
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
  const findbar = new Findbar(window)

  // [OPTIONAL] Customize window options
  findbar.setWindowOptions({ movable: true, resizable: true })

  // [OPTIONAL] Handle the window object when the Findbar is opened
  findbar.setWindowHandler(win => {
    win.webContents.openDevTools()
  })

  // Open the Findbar
  findbar.open()
})
```

## IPC Events

As an alternative, the findbar can be controlled using IPC events in the `renderer` process of the `WebContents` provided during the findbar construction.

### ipcRenderer

If the `contextIsolation` is enabled, the `electron-findbar/remote` will not be available, but the IPC events can be used directly through the preload script:

```js
const $remote = (ipc => ({
    getLastText: async () => ipc.invoke('electron-findbar/last-text'),
    inputChange: (value) => { ipc.send('electron-findbar/input-change', value) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    open: () => { ipc.send('electron-findbar/open') },
    close: () => { ipc.send('electron-findbar/close') },
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

