import * as Blockly from "blockly/core";
import type { Condition, Operand, Filter, RuleMetadata } from "./model";
import { validateCondition } from "./validation";
export { validateCondition } from "./validation";
export class BlockRuleError extends Error {
  constructor(
    message: string,
    public blockId?: string,
  ) {
    super(message);
  }
}
function create(
  ws: Blockly.Workspace,
  type: string,
  fields: Record<string, string | number> = {},
) {
  const b = ws.newBlock("achievement_" + type);
  for (const [k, v] of Object.entries(fields)) b.setFieldValue(String(v), k);
  return b;
}
function connect(parent: Blockly.Block, input: string, child: Blockly.Block) {
  parent.getInput(input)!.connection!.connect(child.outputConnection!);
}
function count(b: Blockly.Block, n: number) {
  b.loadExtraState?.({ count: n });
}
function putOperand(ws: Blockly.Workspace, v: Operand): Blockly.Block {
  if (typeof v === "number") return create(ws, "number", { VALUE: v });
  if (typeof v === "boolean")
    return create(ws, "boolean", { VALUE: String(v) });
  if (typeof v === "string") {
    if (v === "@user") return create(ws, "user");
    if (v.startsWith("@payload."))
      return create(ws, "payload", { FIELD: v.slice(9) });
    return create(ws, "text", { VALUE: v });
  }
  if ("metric" in v) {
    const b = create(ws, "metric_" + v.metric);
    if (v.metric === "difficulty") b.setFieldValue(v.difficulty!, "DIFFICULTY");
    if (v.metric === "categoryScore") b.setFieldValue(v.category!, "CATEGORY");
    b.data = JSON.stringify(v); // 保留后端允许但该指标不使用的可选参数。
    return b;
  }
  const b = create(ws, "statistic", {
    TABLE: v.table,
    AGGREGATE: v.aggregate,
    FIELD: v.fields,
  });
  count(b, v.where.length);
  v.where.forEach((f, i) => {
    const filter = create(ws, "filter", {
      FIELD: f.field,
      OP: f.op ?? "default",
    });
    if (Array.isArray(f.value)) {
      const list = create(ws, "list");
      count(list, f.value.length);
      f.value.forEach((value, j) =>
        connect(list, "V" + j, putOperand(ws, value)),
      );
      connect(filter, "VALUE", list);
    } else connect(filter, "VALUE", putOperand(ws, f.value));
    connect(b, "F" + i, filter);
  });
  return b;
}
function putCondition(ws: Blockly.Workspace, c: Condition): Blockly.Block {
  if (c.op === "all" || c.op === "any") {
    const b = create(ws, c.op);
    count(b, c.conditions.length);
    c.conditions.forEach((v, i) => connect(b, "C" + i, putCondition(ws, v)));
    return b;
  }
  if (c.op === "not") {
    const b = create(ws, "not");
    connect(b, "CONDITION", putCondition(ws, c.condition));
    return b;
  }
  if ("field" in c && ["eq", "neq", "gt", "gte", "lt", "lte"].includes(c.op)) {
    const b = create(ws, "compare", { OP: c.op });
    connect(b, "LEFT", putOperand(ws, c.field));
    connect(b, "RIGHT", putOperand(ws, c.value));
    return b;
  }
  if (c.op === "time-before" || c.op === "time-after")
    return create(ws, c.op, { AT: c.at });
  if (c.op === "time-between")
    return create(ws, c.op, { FROM: c.from, TO: c.to });
  if (c.op === "weekday") return create(ws, c.op, { VALUE: c.value });
  if (c.op === "str-length" || c.op === "str-contains")
    return create(ws, c.op, { FIELD: c.field.slice(9), VALUE: c.value });
  throw new Error("未知规则");
}
export function loadRule(
  ws: Blockly.Workspace,
  type: string,
  condition: unknown,
  m: RuleMetadata,
) {
  // 先完整验证规则，失败时绝不清空当前用户画布。
  validateCondition(condition, m);
  if (!m.events.includes(type))
    throw new Error("未知触发事件，请保留高级 JSON");
  Blockly.Events.disable();
  try {
    ws.clear();
    const root = create(ws, "root", { EVENT: type });
    connect(root, "CONDITION", putCondition(ws, condition));
    if (ws.rendered) {
      for (const b of ws.getAllBlocks(false)) (b as Blockly.BlockSvg).initSvg();
      (ws as Blockly.WorkspaceSvg).render();
      root.moveBy(40, 40);
    }
    ws.clearUndo();
  } finally {
    Blockly.Events.enable();
  }
}
function child(b: Blockly.Block, input: string) {
  const c = b.getInputTargetBlock(input);
  if (!c) throw new BlockRuleError("积木缺少输入，请补全连接", b.id);
  return c;
}
const field = (b: Blockly.Block, key: string) => String(b.getFieldValue(key));
function readOperand(b: Blockly.Block): unknown {
  const t = b.type.replace("achievement_", "");
  if (t === "number") return Number(b.getFieldValue("VALUE"));
  if (t === "text") return field(b, "VALUE");
  if (t === "boolean") return field(b, "VALUE") === "true";
  if (t === "user") return "@user";
  if (t === "payload") return "@payload." + field(b, "FIELD");
  if (t.startsWith("metric_")) {
    const metric = t.slice(7);
    return {
      ...(b.data ? JSON.parse(b.data) : {}),
      metric,
      ...(metric === "difficulty"
        ? { difficulty: field(b, "DIFFICULTY") }
        : {}),
      ...(metric === "categoryScore" ? { category: field(b, "CATEGORY") } : {}),
    };
  }
  if (t === "list")
    return Array.from({ length: Number(b.getFieldValue("COUNT")) }, (_, i) =>
      readOperand(child(b, "V" + i)),
    );
  if (t === "statistic")
    return {
      table: field(b, "TABLE"),
      fields: field(b, "FIELD"),
      aggregate: field(b, "AGGREGATE"),
      where: Array.from(
        { length: Number(b.getFieldValue("COUNT")) },
        (_, i) => {
          const f = child(b, "F" + i);
          if (f.type !== "achievement_filter")
            throw new BlockRuleError("此处需要筛选积木", f.id);
          const op = field(f, "OP");
          return {
            field: field(f, "FIELD"),
            ...(op === "default" ? {} : { op }),
            value: readOperand(child(f, "VALUE")),
          } as Filter;
        },
      ),
    };
  throw new BlockRuleError("此处需要数值、事件字段或统计积木", b.id);
}
function readCondition(b: Blockly.Block, depth = 0): Record<string, unknown> {
  if (depth > 8) throw new BlockRuleError("条件嵌套不能超过 8 层", b.id);
  const op = b.type.replace("achievement_", "");
  if (op === "all" || op === "any")
    return {
      op,
      conditions: Array.from(
        { length: Number(b.getFieldValue("COUNT")) },
        (_, i) => readCondition(child(b, "C" + i), depth + 1),
      ),
    };
  if (op === "not")
    return { op, condition: readCondition(child(b, "CONDITION"), depth + 1) };
  if (op === "compare")
    return {
      op: field(b, "OP"),
      field: readOperand(child(b, "LEFT")),
      value: readOperand(child(b, "RIGHT")),
    };
  if (op === "time-before" || op === "time-after")
    return { op, at: field(b, "AT") };
  if (op === "time-between")
    return { op, from: field(b, "FROM"), to: field(b, "TO") };
  if (op === "weekday") return { op, value: Number(b.getFieldValue("VALUE")) };
  if (op === "str-length" || op === "str-contains")
    return {
      op,
      field: "@payload." + field(b, "FIELD"),
      value:
        op === "str-length"
          ? Number(b.getFieldValue("VALUE"))
          : field(b, "VALUE"),
    };
  throw new BlockRuleError("此处需要条件积木", b.id);
}
export function readRule(
  ws: Blockly.Workspace,
  m: RuleMetadata,
): { type: string; condition: Condition } {
  const tops = ws.getTopBlocks(false),
    roots = tops.filter((b) => b.type === "achievement_root");
  if (roots.length !== 1)
    throw new BlockRuleError("必须保留且仅保留一个事件根积木");
  if (tops.length !== 1)
    throw new BlockRuleError(
      "存在游离积木，请连接或删除后保存",
      tops.find((b) => b !== roots[0])?.id,
    );
  const root = roots[0],
    type = field(root, "EVENT");
  if (!m.events.includes(type))
    throw new BlockRuleError("触发事件不可用", root.id);
  const condition = readCondition(child(root, "CONDITION"));
  try {
    validateCondition(condition, m);
  } catch (e) {
    throw new BlockRuleError(
      e instanceof Error ? e.message : "规则无效",
      root.id,
    );
  }
  return { type, condition };
}
