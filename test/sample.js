const { BrowserWindow, app, Menu, MenuItem } = require('electron')
const Findbar = require('../index')

app.whenReady().then(() => {  
  const window = setupWindow()
  setupFindbar(window)
  Menu.setApplicationMenu(null)
  setupApplicationMenu(window)
})

function setupWindow() {
  const window = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  window.loadFile(`${__dirname}/sample.html`)
  return window
}

function setupFindbar(windowOrWebContents) {
  const findbar = Findbar.from(windowOrWebContents)
  findbar.setWindowOptions({ movable: !true, resizable: true })
  findbar.setWindowHandler(win => { /* handle the findbar window */ })
}

function setupApplicationMenu(window) {
  const appMenu = Menu.getApplicationMenu() ?? new Menu() // Your menu here
  appMenu.append(new MenuItem({ label: 'Findbar', submenu: [
    { label: 'Open', click: () => Findbar.from(window).open(), accelerator: 'CommandOrControl+F' },
    { label: 'Close', click: () => Findbar.from(window).close(), accelerator: 'Esc' },
    { role: 'toggleDevTools', accelerator: 'CommandOrControl+Shift+I' },
    { label: 'Test input propagation', click: () => testMenuHandler(window) }
  ]}))
  Menu.setApplicationMenu(appMenu)
}

function testMenuHandler(window) {
  let count = 0
  setInterval(() => {
    // Both the parent window and the web contents can be used to get the findbar instance
    Findbar.from(count % 2 ? window : window.webContents).startFind('count: ' + count++)
    Findbar.from(window).startFind('cannot show this', true)
  }, 1000)
}