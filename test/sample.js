const { BaseWindow, WebContentsView, app, Menu, MenuItem, ipcMain } = require('electron')
const Findbar = require('electron-findbar')

app.whenReady().then(() => {  
  const window = setupWindow();
  setupFindbar(window);
  Menu.setApplicationMenu(null);
  setupApplicationMenu(window);
})

function setupWindow() {
  const window = new BaseWindow({ width: 800, height: 600 });
  
  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  window.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
  view.webContents.loadFile(`${__dirname}/sample.html`);
  
  return window;
}

function renewWindow(window) {
  const newWindow = new BaseWindow({ width: 800, height: 600 })
  newWindow.contentView.addChildView(window.contentView.children[0]);
  window.close();
  return newWindow;
}

function setupFindbar(windowOrWebContents) {
  const findbar = Findbar.from(windowOrWebContents);
  findbar.setWindowOptions({ movable: !true, resizable: true });
  findbar.setWindowHandler(win => { /* handle the findbar window */ });
}

function setupApplicationMenu(window) {
  const appMenu = Menu.getApplicationMenu() ?? new Menu(); // Your menu here
  appMenu.append(new MenuItem({ label: 'Findbar', submenu: [
    { label: 'Open', click: () => {
      Findbar.from(window).open();
    }, accelerator: 'CommandOrControl+F' },
    { label: 'Close', click: () => Findbar.fromIfExists(window)?.close(), accelerator: 'Esc' },
    { label: 'Detach', click: () => Findbar.fromIfExists(window)?.detach() },
    { label: 'toggleDevTools', accelerator: 'CommandOrControl+Shift+I', click: () => { window.contentView.children[0].webContents.openDevTools() } },
    { label: 'Test input propagation', click: () => testMenuHandler(window) },
    { label: 'Test renew Window', click: () => window = renewWindow(window) }
  ]}))
  Menu.setApplicationMenu(appMenu);
}

function testMenuHandler(window) {
  let count = 0;
  setInterval(() => {
    // Both the parent window and the web contents can be used to get the findbar instance
    Findbar.from(count % 2 ? window : window.webContents).startFind('count: ' + count++);
    Findbar.from(window).startFind('cannot show this', true);
  }, 1000);
}

ipcMain.handle('electron-findbar/change-theme', () => {
  if (Findbar.getDefaultTheme() === 'light') {
    Findbar.setDefaultTheme('dark');
  } else if (Findbar.getDefaultTheme() === 'dark') {
    Findbar.setDefaultTheme('system');
  } else {
    Findbar.setDefaultTheme('light');
  }
});
