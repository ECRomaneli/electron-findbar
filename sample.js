const { BrowserWindow, app, Menu, MenuItem } = require('electron')
const { Findbar } = require('./index')

app.whenReady().then(() => {  
  const window = new BrowserWindow()
  window.loadURL('https://github.com/ECRomaneli/electron-findbar#readme')

  const findbar = new Findbar(window)
  findbar.setWindowOptions({ movable: true, resizable: true })
  findbar.setWindowHandler(win => { /* handle the findbar window */ })
  findbar.open()

  const appMenu = Menu.getApplicationMenu()
  appMenu.append(new MenuItem({ label: 'Findbar', submenu: [
    { label: 'Open', click: () => findbar.open(), accelerator: 'CommandOrControl+F' },
    { label: 'Close', click: () => findbar.isOpen() && findbar.close(), accelerator: 'Esc' },
    { role: 'toggleDevTools', accelerator: 'CommandOrControl+Shift+I' },
  ] }))
  Menu.setApplicationMenu(appMenu)
})
