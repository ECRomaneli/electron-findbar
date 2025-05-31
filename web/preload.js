const $remote = (ipc => ({
    getLastText: async () => ipc.invoke('electron-findbar/last-text'),
    inputChange: (value) => { ipc.send('electron-findbar/input-change', value, true) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    close: () => { ipc.send('electron-findbar/close') },
    onMatchesChange: (listener) => { ipc.on('electron-findbar/matches', listener) },
    onInputFocus: (listener) => { ipc.on('electron-findbar/input-focus', listener) },
    onTextChange: (listener) => { ipc.on('electron-findbar/text-change', listener) }
})) (require('electron').ipcRenderer)

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
    const previousBtn = document.getElementById('previous')
    const nextBtn = document.getElementById('next')
    const closeBtn = document.getElementById('close')
    const matchesEl = document.getElementById('matches')
    const moveBtns = [...document.getElementsByClassName('disabled')]

    previousBtn.addEventListener('click', () => move(false))
    nextBtn.addEventListener('click', () => move(true))
    closeBtn.addEventListener('click', () => $remote.close())
    inputEl.addEventListener('input', inputChange)

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
    $remote.inputChange(inputEl.value)
    inputEl.setSelectionRange(0, inputEl.value.length)
    inputEl.focus()
})