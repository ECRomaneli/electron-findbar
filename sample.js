const { BrowserWindow, app, Menu } = require('electron')
const { Findbar } = require('./index')

app.whenReady().then(() => {  
  const window = new BrowserWindow()
  window.loadURL('https://github.com/ECRomaneli/electron-findbar#readme')

  const findbar = new Findbar(window)
  findbar.setWindowOptions({ movable: true, resizable: true })
  findbar.setWindowHandler(win => {
    win.webContents.openDevTools()
  })
  findbar.open()

  const contextMenu = Menu.buildFromTemplate([
    { role: 'separator' },
    { label: 'Open findbar', click: () => findbar.open(), accelerator: 'CommandOrControl+F' },
    { label: 'Close findbar', click: () => findbar.isOpen() && findbar.close(), accelerator: 'Esc', registerAccelerator: true, acceleratorWorksWhenHidden: true }
  ])

  Menu.setApplicationMenu(contextMenu)
  
})
