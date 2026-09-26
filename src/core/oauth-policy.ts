export const CLIENT_ID = 'branilist-sync';
export function validateRedirect(uri: string, extensionId: string): void {
  if (!/^[a-p]{32}$/.test(extensionId) || uri !== `https://${extensionId}.chromiumapp.org/oauth2`) throw new Error('Callback OAuth incompatível com o ID da extensão.');
}
export function callbackCode(result: string, redirect: string, state: string): string {
  const callback = new URL(result);
  const expected = new URL(redirect);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.username || callback.password || callback.hash ||
    callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== state) throw new Error('Callback OAuth inválido.');
  if (callback.searchParams.has('error')) throw new Error('Autorização cancelada ou recusada.');
  const code = callback.searchParams.get('code');
  if (!code || callback.searchParams.getAll('code').length !== 1) throw new Error('Código OAuth ausente ou duplicado.');
  return code;
}
