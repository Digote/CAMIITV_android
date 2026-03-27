import * as Keychain from 'react-native-keychain';

const SERVICE = 'authToken';

export async function saveToken(token: string) {
  await Keychain.setGenericPassword('user', token, { service: SERVICE });
}

export async function getToken() {
  const credentials = await Keychain.getGenericPassword({ service: SERVICE });
  return credentials ? credentials.password : null;
}

export async function removeToken() {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
