const { BrowserWindow, app, Menu, MenuItem } = require('electron')
const Findbar = require('../index')

app.whenReady().then(() => {  
  const window = setupWindow()
  const findbar = setupFindbar(window)
  Menu.setApplicationMenu(null)
  setupApplicationMenu(findbar)
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

function setupFindbar(window) {
  const findbar = Findbar.from(window)
  findbar.setWindowOptions({ movable: true, resizable: true, height: 100 })
  findbar.setWindowHandler(win => { /* handle the findbar window */ })
  return findbar
}

function setupApplicationMenu(findbar) {
  const appMenu = Menu.getApplicationMenu() ?? new Menu() // Your menu here
  appMenu.append(new MenuItem({ label: 'Findbar', submenu: [
    { label: 'Open', click: () => findbar.open(), accelerator: 'CommandOrControl+F' },
    { label: 'Close', click: () => findbar.close(), accelerator: 'Esc' },
    { role: 'toggleDevTools', accelerator: 'CommandOrControl+Shift+I' },
    { label: 'Test input propagation', click: () => {
      let count = 0
      setInterval(() => {
        findbar.startFind('count: ' + count++)
        findbar.startFind('cannot show this', true)
      }, 1000)
    }}
  ]}))
  Menu.setApplicationMenu(appMenu)
}
