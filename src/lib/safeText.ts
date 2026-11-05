const UNSAFE_DISPLAY_CHARACTER_SOURCE =
  '[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]';
const UNSAFE_DISPLAY_CHARACTER_PATTERN = new RegExp(
  UNSAFE_DISPLAY_CHARACTER_SOURCE,
  'u',
);
const UNSAFE_DISPLAY_CHARACTER_GLOBAL_PATTERN = new RegExp(
  UNSAFE_DISPLAY_CHARACTER_SOURCE,
  'gu',
);

/** 判断文本是否包含会改变方向或段落结构的 Unicode 控制字符。 */
export function containsUnsafeDisplayCharacters(value: string): boolean {
  return UNSAFE_DISPLAY_CHARACTER_PATTERN.test(value);
}

/** 清理来自旧数据或外部接口的显示文本，避免影响相邻 UI。 */
export function sanitizeDisplayText(value: string): string {
  return value
    .normalize('NFC')
    .replace(UNSAFE_DISPLAY_CHARACTER_GLOBAL_PATTERN, '');
}
