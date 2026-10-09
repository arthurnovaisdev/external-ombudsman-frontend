const usernamePattern = /^[A-Za-z0-9._-]+$/

export function validateUsername(value: string): true | string {
  if (!value) return 'Informe o username.'
  if (value.length < 3 || value.length > 50) return 'Use entre 3 e 50 caracteres.'
  if (!usernamePattern.test(value)) return 'Use apenas letras, números, ponto, hífen e underline.'
  return true
}

export function validateLoginPassword(value: string): true | string {
  if (!value?.trim()) return 'Informe a senha.'
  return value.length <= 100 ? true : 'Use no máximo 100 caracteres.'
}

export function validateCurrentPassword(value: string): true | string {
  if (!value?.trim()) return 'Informe a senha atual.'
  return value.length <= 100 ? true : 'Use no máximo 100 caracteres.'
}

export function validateNewPassword(value: string): true | string {
  if (!value?.trim()) return 'Informe a nova senha.'
  return value.length >= 6 && value.length <= 100 ? true : 'Use entre 6 e 100 caracteres.'
}
