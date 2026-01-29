const $remote = (ipc => ({
    getLastState: async () => ipc.invoke('electron-findbar/last-state'),
    inputChange: (value: string) => { ipc.send('electron-findbar/input-change', value, true) },
    matchCase: (value: boolean) => { ipc.send('electron-findbar/match-case', value, true) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    close: () => { ipc.send('electron-findbar/close') },
    onMatchesChange: (listener: Function) => { ipc.on('electron-findbar/matches', listener) },
    onInputFocus: (listener: Function) => { ipc.on('electron-findbar/input-focus', listener) },
    onTextChange: (listener: Function) => { ipc.on('electron-findbar/text-change', listener) },
    onMatchCaseChange: (listener: Function) => { ipc.on('electron-findbar/match-case-change', listener) }
})) (require('electron').ipcRenderer);

let canRequest = true;
let canMove = false;

function inputChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  canRequest = false;
  $remote.inputChange(target.value);
}

function matchCaseChange(btn: HTMLElement): void {
  const newStatus = buttonIsDisabled(btn);
  toggleButton(btn, newStatus);
  $remote.matchCase(newStatus);
}

function move(next: boolean): void {
  if (canRequest && canMove) {
    canRequest = false;
    next ? $remote.next() : $remote.previous();
  }
}

function toggleButton(btn: HTMLElement, status: boolean): void {
  btn.classList[status ? 'remove' : 'add']('disabled');
}

function buttonIsDisabled(btn: HTMLElement): boolean {
  return btn.classList.contains('disabled');
}

document.addEventListener('DOMContentLoaded', async () => {
  const inputEl = document.getElementById('input') as HTMLInputElement;
  const matchCaseBtn = document.getElementById('match-case') as HTMLButtonElement;
  const previousBtn = document.getElementById('previous') as HTMLButtonElement;
  const nextBtn = document.getElementById('next') as HTMLButtonElement;
  const closeBtn = document.getElementById('close') as HTMLButtonElement;
  const matchesEl = document.getElementById('matches')!;
  const moveBtns = [previousBtn, nextBtn].filter((btn) => btn !== null);

  if (!inputEl || !matchCaseBtn || !previousBtn || !nextBtn || !closeBtn || !matchesEl) {
    console.error('Required elements not found in the DOM');
    return;
  }

  matchCaseBtn.addEventListener('click', () => matchCaseChange(matchCaseBtn));
  previousBtn.addEventListener('click', () => move(false));
  nextBtn.addEventListener('click', () => move(true));
  closeBtn.addEventListener('click', () => $remote.close());
  inputEl.addEventListener('input', inputChange);

  $remote.onTextChange((_event: Event, text: string) => {
    inputEl.value = text;
  })

  $remote.onInputFocus(() => {
    inputEl.setSelectionRange(0, inputEl.value.length);
    inputEl.focus();
  })

  $remote.onMatchCaseChange((_e: Event, status: boolean) => toggleButton(matchCaseBtn, status));

  $remote.onMatchesChange((_e: Event, m: { active: number; total: number }) => {
    canRequest = true;
    matchesEl.innerText = inputEl.value ? m.active + '/' + m.total : '';
    for (const moveBtn of moveBtns) {
      toggleButton(moveBtn, (canMove = m.total > 1));
    }
  })

  const lastState = await $remote.getLastState()
  inputEl.value = lastState.text || '';
  if (!lastState.movable) {
    document.body.classList.remove('movable');
  }
  if (process.platform === 'linux') {
    document.body.classList.add('linux');
  }
  toggleButton(matchCaseBtn, lastState.matchCase);
  $remote.inputChange(inputEl.value);
  inputEl.setSelectionRange(0, inputEl.value.length);
  inputEl.focus();
});