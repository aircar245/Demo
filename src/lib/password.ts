export const PASSWORD_HINT = '密码须为 8–64 位，大小写字母、数字、符号至少三类，且不能包含空白或控制字符';

export function isValidPassword(password: string): boolean {
  if (!/^[^\s\p{Cc}\p{Cf}]{8,64}$/u.test(password)) return false;
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(pattern => pattern.test(password)).length >= 3;
}
