import * as Blockly from "blockly/core";
import {
  DIFFICULTIES,
  EVENT_LABELS,
  METRIC_LABELS,
  OPERATORS,
  PAYLOAD_FIELDS,
  type RuleMetadata,
} from "./model";
const options = (values: string[], labels: Record<string, string> = {}) =>
  values.map((v) => [labels[v] ?? v, v] as [string, string]);
const dropdown = (values: string[], labels: Record<string, string> = {}) =>
  new Blockly.FieldDropdown(options(values, labels));
type DynamicBlock = Blockly.Block & {
  itemCount_: number;
  updateItems_: (n: number) => void;
};
function variableInputs(
  block: Blockly.Block,
  prefix: string,
  label: string,
  min: number,
  max: number,
  check: string | null,
) {
  const b = block as DynamicBlock;
  b.itemCount_ = 0;
  b.updateItems_ = function (n: number) {
    for (let i = this.itemCount_ - 1; i >= n; i--) this.removeInput(prefix + i);
    for (let i = this.itemCount_; i < n; i++)
      this.appendValueInput(prefix + i)
        .setCheck(check)
        .appendField(label + " " + (i + 1));
    this.itemCount_ = n;
  };
  block
    .appendDummyInput()
    .appendField("数量")
    .appendField(
      new Blockly.FieldNumber(min, min, max, 1, (v) => {
        b.updateItems_(Number(v));
        return v;
      }),
      "COUNT",
    );
  b.updateItems_(min);
  block.saveExtraState = () => ({ count: b.itemCount_ });
  block.loadExtraState = (state: { count: number }) => {
    const n = Math.max(min, Math.min(max, state.count));
    b.updateItems_(n);
    b.setFieldValue(String(n), "COUNT");
  };
}
export function registerBlocks(m: RuleMetadata) {
  const define = (
    name: string,
    colour: number,
    init: (b: Blockly.Block) => void,
    output: string | null = "Operand",
  ) => {
    Blockly.Blocks["achievement_" + name] = {
      init(this: Blockly.Block) {
        this.setColour(colour);
        if (output) this.setOutput(true, output);
        init(this);
        this.setInputsInline(false);
      },
    };
  };
  define(
    "root",
    45,
    (b) => {
      b.appendDummyInput()
        .appendField("当")
        .appendField(dropdown(m.events, EVENT_LABELS), "EVENT")
        .appendField("发生");
      b.appendValueInput("CONDITION").setCheck("Condition").appendField("满足");
      b.appendDummyInput().appendField("解锁当前成就");
      b.setDeletable(false);
    },
    null,
  );
  for (const op of ["all", "any"])
    define(
      op,
      265,
      (b) => {
        b.appendDummyInput().appendField(
          op === "all" ? "全部条件满足" : "任一条件满足",
        );
        variableInputs(b, "C", "条件", 1, 20, "Condition");
      },
      "Condition",
    );
  define(
    "not",
    265,
    (b) => {
      b.appendValueInput("CONDITION")
        .setCheck("Condition")
        .appendField("不满足");
    },
    "Condition",
  );
  define(
    "compare",
    265,
    (b) => {
      b.appendValueInput("LEFT").setCheck("Operand").appendField("比较");
      b.appendDummyInput().appendField(
        dropdown(
          Object.keys(OPERATORS).filter((x) => m.operators.includes(x)),
          OPERATORS,
        ),
        "OP",
      );
      b.appendValueInput("RIGHT").setCheck("Operand");
    },
    "Condition",
  );
  define("number", 190, (b) =>
    b
      .appendDummyInput()
      .appendField("数字")
      .appendField(new Blockly.FieldNumber(0), "VALUE"),
  );
  define("text", 190, (b) =>
    b
      .appendDummyInput()
      .appendField("文字")
      .appendField(new Blockly.FieldTextInput(""), "VALUE"),
  );
  define("boolean", 190, (b) =>
    b
      .appendDummyInput()
      .appendField("布尔值")
      .appendField(
        new Blockly.FieldDropdown([
          ["是", "true"],
          ["否", "false"],
        ]),
        "VALUE",
      ),
  );
  define("user", 190, (b) => b.appendDummyInput().appendField("当前用户 ID"));
  define("payload", 190, (b) => {
    b.appendDummyInput()
      .appendField("事件字段")
      .appendField(new Blockly.FieldTextInput("isCorrect"), "FIELD");
    b.appendDummyInput()
      .appendField("快捷选择")
      .appendField(
        new Blockly.FieldDropdown(
          [["自定义", "custom"], ...options(PAYLOAD_FIELDS)],
          function (this: Blockly.FieldDropdown, value) {
            if (value !== "custom")
              this.getSourceBlock()?.setFieldValue(value, "FIELD");
            return value;
          },
        ),
        "PRESET",
      );
  });
  for (const metric of m.metrics) {
    if (!METRIC_LABELS[metric]) continue;
    define("metric_" + metric, 145, (b) => {
      b.appendDummyInput().appendField(METRIC_LABELS[metric]);
      if (metric === "difficulty")
        b.appendDummyInput().appendField(dropdown(DIFFICULTIES), "DIFFICULTY");
      if (metric === "categoryScore")
        b.appendDummyInput()
          .appendField("分类")
          .appendField(new Blockly.FieldTextInput("crypto"), "CATEGORY");
    });
  }
  for (const op of ["time-before", "time-after", "time-between"])
    define(
      op,
      25,
      (b) => {
        b.appendDummyInput().appendField(
          op === "time-before"
            ? "事件时间早于"
            : op === "time-after"
              ? "事件时间晚于"
              : "事件时间处于区间",
        );
        for (const key of op === "time-between" ? ["FROM", "TO"] : ["AT"])
          b.appendDummyInput()
            .appendField(key === "TO" ? "结束" : "时间")
            .appendField(
              new Blockly.FieldTextInput("2026-09-11T00:00:00+08:00", (v) => {
                // 无时区的本地输入解释为北京时间，不改变已带时区的历史值。
                return /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(v)
                  ? v + "+08:00"
                  : v;
              }),
              key,
            );
        b.setTooltip("北京时间可输入 2026-09-11T12:00；将自动加上 +08:00。");
      },
      "Condition",
    );
  define(
    "weekday",
    25,
    (b) =>
      b
        .appendDummyInput()
        .appendField("事件发生在")
        .appendField(
          new Blockly.FieldDropdown(
            ["日", "一", "二", "三", "四", "五", "六"].map((d, i) => [
              "星期" + d,
              String(i),
            ]),
          ),
          "VALUE",
        ),
    "Condition",
  );
  for (const op of ["str-length", "str-contains"])
    define(
      op,
      25,
      (b) => {
        b.appendDummyInput()
          .appendField("事件字段")
          .appendField(new Blockly.FieldTextInput("path"), "FIELD");
        b.appendDummyInput()
          .appendField(op === "str-length" ? "长度等于" : "包含文字")
          .appendField(
            op === "str-length"
              ? new Blockly.FieldNumber(0, 0, undefined, 1)
              : new Blockly.FieldTextInput(""),
            "VALUE",
          );
      },
      "Condition",
    );
  define("statistic", 205, (b) => {
    b.appendDummyInput()
      .appendField("数据统计")
      .appendField(
        new Blockly.FieldDropdown(options(Object.keys(m.tables)), (value) => {
          const f = b.getField("FIELD") as Blockly.FieldDropdown | null;
          if (f) {
            const old = f.getValue();
            f.setOptions(options(m.tables[value]));
            if (m.tables[value].includes(String(old))) f.setValue(old);
          }
          return value;
        }),
        "TABLE",
      );
    b.appendDummyInput()
      .appendField("计算")
      .appendField(
        new Blockly.FieldDropdown([
          ["数量", "count"],
          ["去重数量", "distinct"],
          ["总和", "sum"],
          ["最大值", "max"],
          ["最小值", "min"],
        ]),
        "AGGREGATE",
      )
      .appendField(
        new Blockly.FieldDropdown(() =>
          options(m.tables[String(b.getFieldValue("TABLE"))] ?? []),
        ),
        "FIELD",
      );
    variableInputs(b, "F", "筛选", 0, 20, "Filter");
    b.setTooltip(
      "聚合不会自动限定当前用户；需要当前用户数据时，添加用户字段等于当前用户 ID 的筛选。",
    );
  });
  define(
    "filter",
    205,
    (b) => {
      b.appendDummyInput()
        .appendField("字段")
        .appendField(
          dropdown([...new Set(Object.values(m.tables).flat())]),
          "FIELD",
        )
        .appendField(
          new Blockly.FieldDropdown([
            ["等于（默认）", "default"],
            ...options(Object.keys(OPERATORS), OPERATORS),
            ["属于列表", "in"],
          ]),
          "OP",
        );
      b.appendValueInput("VALUE")
        .setCheck(["Operand", "List"])
        .appendField("值");
    },
    "Filter",
  );
  define(
    "list",
    190,
    (b) => {
      b.appendDummyInput().appendField("值列表");
      variableInputs(b, "V", "值", 1, 100, "Operand");
    },
    "List",
  );
}
export function toolbox(
  m: RuleMetadata,
): Blockly.utils.toolbox.ToolboxDefinition {
  const blocks = (names: string[]) =>
    names.map((name) => ({ kind: "block", type: "achievement_" + name }));
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "逻辑条件",
        colour: "#8255bc",
        contents: blocks([
          ...["all", "any", "not"].filter((x) => m.operators.includes(x)),
          ...(Object.keys(OPERATORS).some((x) => m.operators.includes(x))
            ? ["compare"]
            : []),
        ]),
      },
      {
        kind: "category",
        name: "解题统计",
        colour: "#338a61",
        contents: blocks(
          m.metrics.filter((x) => METRIC_LABELS[x]).map((x) => "metric_" + x),
        ),
      },
      {
        kind: "category",
        name: "值与事件",
        colour: "#287f93",
        contents: blocks([
          "number",
          "text",
          "boolean",
          "user",
          "payload",
          "list",
        ]),
      },
      {
        kind: "category",
        name: "时间与文字",
        colour: "#a65e2a",
        contents: blocks(
          [
            "time-before",
            "time-after",
            "time-between",
            "weekday",
            "str-length",
            "str-contains",
          ].filter((x) => m.operators.includes(x)),
        ),
      },
      {
        kind: "category",
        name: "高级聚合",
        colour: "#3573a0",
        contents: blocks(["statistic", "filter"]),
      },
    ],
  };
}
