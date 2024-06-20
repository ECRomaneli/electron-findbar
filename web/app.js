const { ipcRenderer } = require('electron')

const $remote = {
    getLastText: async () => ipcRenderer.invoke('electron-findbar/last-text'),
    inputChange: (value) => { ipcRenderer.send('electron-findbar/input-change', value) },
    previous: () => { ipcRenderer.send('electron-findbar/previous') },
    next: () => { ipcRenderer.send('electron-findbar/next') },
    close: () => { ipcRenderer.send('electron-findbar/close') },
    onMatchesChange: (listener) => { ipcRenderer.on('electron-findbar/matches', listener) },
    onInputFocus: (listener) => { ipcRenderer.on('electron-findbar/input-focus', listener) },
    onTextChange: (listener) => { ipcRenderer.on('electron-findbar/text-change', listener) }
}

let canRequest = true, canMove = false

function inputChange(e) {
    canRequest = false
    $remote.inputChange(e.target.value)
}

function move(next) {
    if (canRequest && canMove) {
        canRequest = false
        next ? $remote.next() : $remote.previous()
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const inputEl = document.getElementById('input')
    const matchesEl = document.getElementById('matches')
    const moveBtns = [...document.getElementsByClassName('disabled')]

    $remote.onMatchesChange((_, m) => {
        canRequest = true
        matchesEl.innerText = inputEl.value ? m.active + '/' + m.total : ''

        for (var moveBtn of moveBtns) {
            (canMove = m.total > 1) ? 
                moveBtn.classList.remove('disabled') :
                moveBtn.classList.add('disabled')
        }
    })

    $remote.onInputFocus(() => {
        inputEl.setSelectionRange(0, inputEl.value.length)
        inputEl.focus()
    })

    $remote.onTextChange((_, text) => { inputEl.value = text })

    inputEl.value = await $remote.getLastText()
    inputEl.setSelectionRange(0, inputEl.value.length)
    inputEl.focus()
})