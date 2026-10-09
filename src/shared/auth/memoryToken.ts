// Nunca persiste o JWT em localStorage, sessionStorage ou cookies.
let accessToken: string | null = null

export const memoryToken = {
  get: (): string | null => accessToken,
  set: (token: string): void => { accessToken = token },
  clear: (): void => { accessToken = null },
}
