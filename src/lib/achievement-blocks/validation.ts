import { DIFFICULTIES, type RuleMetadata, type Condition } from "./model";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function fail(message: string): never {
  throw new Error(message);
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k)))
    fail("规则包含未知字段，请使用高级 JSON 编辑以保留原始内容");
}
function scalar(v: unknown) {
  return (
    typeof v === "string" ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v))
  );
}
function operand(v: unknown, m: RuleMetadata) {
  if (scalar(v)) {
    if (typeof v === "string" && v.length > 500) fail("字符串不能超过 500 字");
    return;
  }
  if (!object(v)) fail("比较值必须是数字、文字、布尔值或统计积木");
  if (typeof v.metric === "string") {
    keys(v, ["metric", "category", "difficulty"]);
    if (!m.metrics.includes(v.metric)) fail("未知统计指标，请保留 JSON");
    if (
      v.metric === "difficulty" &&
      !DIFFICULTIES.includes(String(v.difficulty))
    )
      fail("请选择支持的难度");
    if (
      v.metric === "categoryScore" &&
      (typeof v.category !== "string" || !v.category)
    )
      fail("分类得分需要分类名称");
    if (
      (v.category !== undefined && typeof v.category !== "string") ||
      (v.difficulty !== undefined && typeof v.difficulty !== "string")
    )
      fail("统计参数必须是文字");
    return;
  }
  keys(v, ["table", "fields", "aggregate", "where"]);
  const fields = m.tables[String(v.table)];
  if (
    !fields?.includes(String(v.fields)) ||
    !["count", "distinct", "sum", "max", "min"].includes(String(v.aggregate))
  )
    fail("统计表、字段或聚合方式不受支持");
  if (!Array.isArray(v.where) || v.where.length > 20)
    fail("聚合最多允许 20 条筛选");
  for (const f of v.where) {
    if (!object(f)) fail("筛选条件格式无效");
    keys(f, ["field", "op", "value"]);
    if (
      !fields.includes(String(f.field)) ||
      !["eq", "neq", "gt", "gte", "lt", "lte", "in"].includes(
        String(f.op ?? "eq"),
      )
    )
      fail("筛选字段或比较方式无效");
    const values = f.op === "in" ? f.value : [f.value];
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 100 ||
      !values.every(scalar)
    )
      fail("筛选需要 1～100 个有效值");
  }
}
export function validateCondition(
  v: unknown,
  m: RuleMetadata,
  depth = 0,
): asserts v is Condition {
  if (!object(v) || typeof v.op !== "string" || !m.operators.includes(v.op))
    fail("未知条件，请保留高级 JSON");
  if (depth > 8) fail("条件嵌套不能超过 8 层");
  if (v.op === "all" || v.op === "any") {
    keys(v, ["op", "conditions"]);
    if (
      !Array.isArray(v.conditions) ||
      !v.conditions.length ||
      v.conditions.length > 20
    )
      fail("全部／任一条件需要 1～20 个子条件");
    v.conditions.forEach((c) => validateCondition(c, m, depth + 1));
    return;
  }
  if (v.op === "not") {
    keys(v, ["op", "condition"]);
    validateCondition(v.condition, m, depth + 1);
    return;
  }
  if (["eq", "neq", "gt", "gte", "lt", "lte"].includes(v.op)) {
    keys(v, ["op", "field", "value"]);
    operand(v.field, m);
    operand(v.value, m);
    return;
  }
  const date = (x: unknown) =>
    typeof x === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(x) &&
    Number.isFinite(Date.parse(x));
  if (v.op === "time-before" || v.op === "time-after") {
    keys(v, ["op", "at"]);
    if (!date(v.at)) fail("时间必须有效并包含时区");
    return;
  }
  if (v.op === "time-between") {
    keys(v, ["op", "from", "to"]);
    if (
      !date(v.from) ||
      !date(v.to) ||
      Date.parse(String(v.from)) > Date.parse(String(v.to))
    )
      fail("时间区间无效或起点晚于终点");
    return;
  }
  if (v.op === "weekday") {
    keys(v, ["op", "value"]);
    if (
      !Number.isInteger(v.value) ||
      Number(v.value) < 0 ||
      Number(v.value) > 6
    )
      fail("请选择星期");
    return;
  }
  if (v.op === "str-length" || v.op === "str-contains") {
    keys(v, ["op", "field", "value"]);
    if (typeof v.field !== "string" || !v.field.startsWith("@payload."))
      fail("字符串条件需要事件字段");
    if (
      v.op === "str-length"
        ? !Number.isInteger(v.value) || Number(v.value) < 0
        : typeof v.value !== "string"
    )
      fail("字符串条件的值无效");
    return;
  }
  fail("编辑器尚不支持该条件，请保留 JSON");
}
