"use client";
import * as Blockly from "blockly/core";
import * as Zh from "blockly/msg/zh-hans";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { registerBlocks, toolbox } from "@/lib/achievement-blocks/blocks";
import {
  BlockRuleError,
  loadRule,
  readRule,
} from "@/lib/achievement-blocks/codec";
import {
  EVENT_LABELS,
  type RuleMetadata,
} from "@/lib/achievement-blocks/model";
import { useThemeStore } from "@/store/themeStore";
import styles from "./editor.module.css";
export interface RuleEditorHandle {
  getRule: () => { type: string; condition: Record<string, unknown> };
}
interface Props {
  type: string;
  condition: Record<string, unknown>;
  metadata: RuleMetadata;
  onDirty: () => void;
}
const RuleEditor = forwardRef<RuleEditorHandle, Props>(function RuleEditor(
  { type, condition, metadata: metadataProp, onDirty },
  ref,
) {
  // 编辑期间固定元数据快照，后台刷新不能重建工作区并覆盖草稿。
  const [metadata] = useState(metadataProp);
  const container = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    workspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const initial = useRef({ type, condition }),
    dirtyCallback = useRef(onDirty);
  const [advanced, setAdvanced] = useState(false),
    [json, setJson] = useState(JSON.stringify(condition, null, 2)),
    [eventType, setEventType] = useState(type);
  const [error, setError] = useState(""),
    [full, setFull] = useState(false),
    [library, setLibrary] = useState(true),
    [ready, setReady] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    dirtyCallback.current = onDirty;
  }, [onDirty]);
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : "规则无效");
    if (e instanceof BlockRuleError && e.blockId && workspace.current) {
      workspace.current.highlightBlock(e.blockId);
      workspace.current.centerOnBlock(e.blockId);
    }
  }
  function getRule() {
    try {
      if (advanced) {
        const value: unknown = JSON.parse(json);
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error("规则 JSON 必须是对象");
        return { type: eventType, condition: value as Record<string, unknown> };
      }
      if (!workspace.current) throw new Error("画布尚未就绪");
      return readRule(workspace.current, metadata);
    } catch (e) {
      report(e);
      throw e;
    }
  }
  useImperativeHandle(ref, () => ({ getRule }));
  useEffect(() => {
    Blockly.setLocale(
      Object.fromEntries(
        Object.entries(Zh)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, String(value)]),
      ),
    );
    registerBlocks(metadata);
    const ws = Blockly.inject(container.current!, {
      renderer: "zelos",
      media: "/blockly-media/",
      toolbox: toolbox(metadata),
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.8,
        maxScale: 1.5,
        minScale: 0.35,
        scaleSpeed: 1.1,
      },
      grid: { spacing: 24, length: 2, colour: "#728095", snap: false },
      sounds: false,
    });
    workspace.current = ws;
    try {
      loadRule(ws, initial.current.type, initial.current.condition, metadata);
    } catch (e) {
      setAdvanced(true);
      report(e);
    }
    let disposed = false;
    const listener = (event: Blockly.Events.Abstract) => {
      if (
        event.isUiEvent ||
        ![
          Blockly.Events.BLOCK_CREATE,
          Blockly.Events.BLOCK_DELETE,
          Blockly.Events.BLOCK_MOVE,
          Blockly.Events.BLOCK_CHANGE,
        ].some((type) => type === event.type)
      )
        return;
      dirtyCallback.current();
      try {
        const value = readRule(ws, metadata);
        setEventType(value.type);
        setError("");
        ws.highlightBlock(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "请补全积木");
      }
    };
    // 丢弃初始装载事件，不将已有定义误标记为未保存。
    const start = setTimeout(() => {
      if (!disposed) ws.addChangeListener(listener);
    }, 0);
    const observer = new ResizeObserver(() => {
      if (!disposed) Blockly.svgResize(ws);
    });
    observer.observe(container.current!);
    setReady(true);
    return () => {
      disposed = true;
      clearTimeout(start);
      observer.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      workspace.current = null;
    };
  }, [metadata]);
  useEffect(() => {
    const ws = workspace.current;
    if (!ws) return;
    ws.setTheme(
      Blockly.Theme.defineTheme("cnss-" + theme, {
        name: "cnss-" + theme,
        base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: theme === "dark" ? "#171b23" : "#f5f7fa",
          toolboxBackgroundColour: theme === "dark" ? "#222733" : "#e8edf3",
          toolboxForegroundColour: theme === "dark" ? "#e2e6ef" : "#1e293b",
          flyoutBackgroundColour: theme === "dark" ? "#2a3140" : "#dce4ef",
          flyoutForegroundColour: theme === "dark" ? "#e2e6ef" : "#1e293b",
          flyoutOpacity: 1,
          scrollbarColour: "#65748a",
          scrollbarOpacity: 0.5,
          insertionMarkerColour: "#f5d700",
          insertionMarkerOpacity: 0.5,
        },
        fontStyle: { family: "Inter, sans-serif", weight: "500", size: 12 },
      }),
    );
  }, [theme, ready]);
  useEffect(() => {
    if (workspace.current) {
      workspace.current.getToolbox()?.setVisible(library && !advanced);
      Blockly.svgResize(workspace.current);
    }
  }, [library, advanced, full]);
  useEffect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", exit);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", exit);
    };
  }, [full]);
  function toggle() {
    const ws = workspace.current;
    if (!ws) return;
    try {
      if (!advanced) {
        const rule = readRule(ws, metadata);
        setJson(JSON.stringify(rule.condition, null, 2));
        setEventType(rule.type);
        setAdvanced(true);
      } else {
        const value: unknown = JSON.parse(json);
        loadRule(ws, eventType, value, metadata);
        setAdvanced(false);
      }
      setError("");
    } catch (e) {
      report(e);
    }
  }
  return (
    <div ref={shell} className={`${styles.editor} ${full ? styles.full : ""}`}>
      <div className={styles.toolbar}>
        <div className={styles.mode}>
          <span className={styles.dot} />
          {advanced ? "规则 JSON" : "积木工作区"}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={toggle} disabled={!ready}>
            {advanced ? "切换积木画布" : "高级 JSON 编辑"}
          </button>
          {!advanced && (
            <>
              <button
                type="button"
                aria-label="撤销"
                onClick={() => workspace.current?.undo(false)}
              >
                ↶ 撤销
              </button>
              <button
                type="button"
                aria-label="重做"
                onClick={() => workspace.current?.undo(true)}
              >
                ↷ 重做
              </button>
              <button
                type="button"
                onClick={() => workspace.current?.cleanUp()}
              >
                整理布局
              </button>
              <button
                type="button"
                onClick={() => {
                  const selected = Blockly.getSelected();
                  if (
                    selected instanceof Blockly.BlockSvg &&
                    selected.isDeletable()
                  )
                    selected.dispose(true);
                }}
              >
                删除选中
              </button>
              <button type="button" onClick={() => setLibrary(!library)}>
                {library ? "收起积木库" : "展开积木库"}
              </button>
            </>
          )}
          <button type="button" onClick={() => setFull(!full)}>
            {full ? "退出全屏" : "全屏编辑"}
          </button>
        </div>
      </div>
      <p className={styles.hint}>
        {advanced
          ? "保留规则的完整表达。切回画布前会检查是否能无损转换。"
          : "从左侧拖出积木，接入「满足」插槽。紫色组合条件，绿色读取解题统计。"}
      </p>
      {advanced && (
        <div className={styles.json}>
          <label>
            触发事件
            <select
              aria-label="触发事件"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                dirtyCallback.current();
              }}
            >
              {!metadata.events.includes(eventType) && (
                <option value={eventType}>{eventType}（未知事件）</option>
              )}
              {metadata.events.map((t) => (
                <option key={t} value={t}>
                  {EVENT_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="achievement-rule-json">规则 JSON</label>
          <textarea
            id="achievement-rule-json"
            spellCheck={false}
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              dirtyCallback.current();
            }}
          />
          <details>
            <summary>可用事件、指标与字段</summary>
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
          </details>
        </div>
      )}
      <div
        ref={container}
        className={styles.canvas}
        style={{ display: advanced ? "none" : undefined }}
        aria-label="成就规则积木画布"
      />
      <div className={styles.status} role="status" data-error={Boolean(error)}>
        {error || "规则连接完整；保存时将由后端再次校验。"}
      </div>
    </div>
  );
});
export default RuleEditor;
