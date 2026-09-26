const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const authButton = document.querySelector<HTMLButtonElement>('#auth')!;
let authenticated = false;

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  authenticated = Boolean(response?.authenticated);
  statusEl.textContent = authenticated ? 'Conta Branilist vinculada.' : 'Nenhuma conta vinculada.';
  authButton.textContent = authenticated ? 'Desvincular conta' : 'Vincular conta';
}

authButton.addEventListener('click', async () => {
  authButton.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: authenticated ? 'AUTH_LOGOUT' : 'AUTH_LOGIN',
    });

    if (!response?.ok) throw new Error(response?.error ?? 'Falha desconhecida');
    await refresh();
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    authButton.disabled = false;
  }
});

void refresh();
