"use client";

import {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { RuleEditorHandle } from "@/components/achievements/editor/RuleEditor";
const RuleEditor = dynamic(
  () => import("@/components/achievements/editor/RuleEditor"),
  {
    ssr: false,
    loading: () => <p className="p-4 text-xs">正在加载积木编辑器…</p>,
  },
);
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelReveal } from "@/components/ow/PanelReveal";
import { GlitchText } from "@/components/ow/GlitchText";
import { getUserList } from "@/lib/api/admin";
import { getApiErrorMessage } from "@/lib/api/file";
import {
  deleteAchievement,
  getBackfill,
  grantAchievement,
  listAchievements,
  previewBackfill,
  ruleMetadata,
  saveAchievement,
  startBackfill,
  validateRule,
  type Definition,
  type Job,
} from "@/lib/api/achievement";
import { useAuthStore } from "@/store/authStore";
import styles from "./page.module.css";

type FormState = Omit<Definition, "id">;
type Notice = { text: string; tone: "success" | "error" | "info" };

const EMPTY: FormState = {
  key: "",
  name: "",
  description: "",
  color: "#F5D700",
  icon: "★",
  rare: 0,
  sortOrder: 0,
  type: "flag.submit",
  condition: { op: "gte", field: { metric: "solved" }, value: 1 },
};
const inputClass = `${styles.control} w-full ow-mono text-[11px]`;
const neutralButton = `${styles.button} ${styles.buttonNeutral}`;
const primaryButton = `${styles.button} ${styles.buttonPrimary}`;
const dangerButton = `${styles.button} ${styles.buttonDanger}`;

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="pt-0.5 ow-mono text-[9px]" style={{ color: "#F5D700" }}>
        {index}
      </span>
      <div className="min-w-0">
        <h2
          className="ow-mono text-[11px] uppercase tracking-[0.16em]"
          style={{ color: "var(--ow-text-mid)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="mt-1 text-[11px] leading-relaxed"
            style={{ color: "var(--ow-text-muted)" }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block ow-mono text-[9px] uppercase tracking-widest"
      style={{ color: "var(--ow-text-dim)" }}
    >
      {children}
    </label>
  );
}

function Rarity({ value, color }: { value: number; color: string }) {
  const rarity = Math.max(0, Math.min(5, value));
  return (
    <span className="flex items-center gap-1" aria-label={`稀有度 ${rarity}`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="block h-1 w-1"
          style={{
            background: index < rarity ? color : "var(--ow-border-dim)",
          }}
        />
      ))}
    </span>
  );
}

function DefinitionItem({
  item,
  active,
  index,
  onSelect,
}: {
  item: Definition;
  active: boolean;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.2,
        delay: Math.min(index * 0.035, 0.25),
        ease: "easeOut",
      }}
      onClick={onSelect}
      className={`${styles.item} ${active ? styles.itemActive : ""} block w-full text-left`}
      style={{ "--achievement-color": item.color } as CSSProperties}
    >
      <span className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center border ow-mono text-base"
          style={{
            borderColor: active ? item.color : "var(--ow-border)",
            color: item.color,
            background: `${item.color}0D`,
          }}
        >
          {item.icon || "·"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className="truncate text-[13px]"
              style={{
                color: active ? "var(--ow-text)" : "var(--ow-text-mid)",
              }}
            >
              {item.name}
            </span>
            <span
              className="ow-mono text-[9px]"
              style={{ color: "var(--ow-text-muted)" }}
            >
              #{String(item.id).padStart(2, "0")}
            </span>
          </span>
          <span
            className="mt-1 block truncate ow-mono text-[9px] uppercase tracking-wider"
            style={{ color: "var(--ow-text-muted)" }}
          >
            {item.key}
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span
              className="ow-mono text-[8px] uppercase"
              style={{ color: "var(--ow-text-muted)" }}
            >
              {item.type}
            </span>
            <Rarity value={item.rare} color={item.color} />
          </span>
        </span>
      </span>
    </motion.button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-32 items-center justify-center border border-dashed px-5 text-center"
      style={{ borderColor: "var(--ow-border)" }}
    >
      <span
        className="ow-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--ow-text-muted)" }}
      >
        &gt; {children}
      </span>
    </div>
  );
}

export default function AchievementsAdmin() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [panelReady, setPanelReady] = useState(false);
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [editing, setEditing] = useState<number>();
  const [form, setForm] = useState<FormState>(EMPTY);
  const ruleEditor = useRef<RuleEditorHandle>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && !window.confirm("存在未保存的修改，确定离开？")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<number>();
  const [job, setJob] = useState<Job | null>(null);
  const enabled = (user?.role ?? 0) > 0;
  const onPanelComplete = useCallback(() => setPanelReady(true), []);

  const definitions = useQuery({
    queryKey: ["admin-achievements"],
    queryFn: listAchievements,
    enabled,
  });
  const metadata = useQuery({
    queryKey: ["achievement-metadata"],
    queryFn: ruleMetadata,
    enabled,
  });
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: getUserList,
    enabled,
  });
  const progress = useQuery({
    queryKey: ["achievement-job", job?.id],
    queryFn: () => getBackfill(job!.id),
    enabled: enabled && Boolean(job),
    refetchInterval: (query) =>
      query.state.data?.state === "running" ? 1000 : false,
  });
  const shownJob = progress.data ?? job;
  const filteredDefinitions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (definitions.data ?? []).filter(
      (item) =>
        !keyword ||
        `${item.name} ${item.key} ${item.type}`.toLowerCase().includes(keyword),
    );
  }, [definitions.data, search]);
  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    return (users.data ?? []).filter(
      (item) =>
        !keyword ||
        `${item.username} ${item.userId}`.toLowerCase().includes(keyword),
    );
  }, [userSearch, users.data]);

  function currentRule() {
    if (!metadata.data || metadata.isError || !ruleEditor.current)
      throw new Error("规则编辑器尚未就绪，请重试加载元数据");
    return ruleEditor.current.getRule();
  }

  function load(item?: Definition, force = false) {
    if (!force && dirty && !window.confirm("存在未保存的修改，确定切换成就？"))
      return;
    setEditing(item?.id);
    setForm(item ?? EMPTY);
    setEditorVersion((value) => value + 1);
    setDirty(false);
    setTarget(undefined);
    setUserSearch("");
    setNotice(null);
    setJob(null);
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
      await queryClient.invalidateQueries({ queryKey: ["achievements"] });
    } catch (error) {
      setNotice({
        text: getApiErrorMessage(
          error,
          error instanceof Error ? error.message : "操作失败",
        ),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] items-center justify-center p-8 ow-mono text-xs">
        <span style={{ color: "var(--ow-text-dim)" }}>
          &gt; 请先{" "}
          <Link
            href="/login"
            className="underline"
            style={{ color: "var(--accent)" }}
          >
            登录
          </Link>
          。
        </span>
      </div>
    );
  if (user.role === 0)
    return (
      <div
        className="flex min-h-[calc(100dvh-3rem)] items-center justify-center p-8 ow-mono text-xs"
        style={{ color: "var(--danger)" }}
      >
        &gt; ACCESS DENIED · 仅管理员可访问
      </div>
    );

  return (
    <main
      className="ow-dots min-h-[calc(100dvh-3rem)] p-3 md:p-4"
      style={{ backgroundColor: "var(--ow-bg)", color: "var(--ow-text)" }}
    >
      <PanelReveal
        contentSized
        onComplete={onPanelComplete}
        className="min-w-0"
        style={{ background: "var(--ow-panel-bg-main)" }}
      >
        <div className="min-w-0">
          <header
            className={`${styles.header} border-b px-4 py-5 md:px-6`}
            style={{ borderColor: "var(--ow-border)" }}
          >
            <Link
              href="/admin"
              className="mb-5 inline-flex items-center gap-2 ow-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ color: "var(--ow-text-muted)" }}
            >
              ← ADMIN PANEL
            </Link>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <GlitchText
                  active={panelReady}
                  text="ACHIEVEMENT_CONTROL"
                  tag="h1"
                  className="block font-['Inter'] text-2xl font-light leading-none tracking-tight sm:text-3xl"
                  style={{ color: "var(--ow-text)" }}
                  duration={650}
                />
                <p
                  className="mt-3 max-w-2xl text-xs leading-relaxed"
                  style={{ color: "var(--ow-text-dim)" }}
                >
                  管理成就定义、触发规则与授予记录。规则更新不会撤回用户已解锁的成就。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="flex items-center gap-2 border px-3 py-2"
                  style={{
                    borderColor: "var(--ow-border)",
                    background: "var(--ow-panel)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: "#F5D700",
                      boxShadow: "0 0 6px rgba(245,215,0,.55)",
                    }}
                  />
                  <span
                    className="ow-mono text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--ow-text-muted)" }}
                  >
                    {definitions.data?.length ?? 0} DEFINITIONS
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="+ 新建成就"
                  className={primaryButton}
                  onClick={() => load()}
                >
                  [ + NEW ACHIEVEMENT ]
                </button>
              </div>
            </div>
          </header>

          {notice && (
            <div
              role={notice.tone === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`${styles.notice} mx-4 mt-4 md:mx-6`}
              data-tone={notice.tone}
            >
              <span className="ow-mono text-[10px] uppercase tracking-wider">
                {notice.tone === "success"
                  ? "✓ "
                  : notice.tone === "error"
                    ? "✗ "
                    : "> "}
                {notice.text}
              </span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="关闭提示"
                className="ow-mono text-xs opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </div>
          )}

          <div className="grid min-w-0 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside
              className="min-w-0 border-b xl:border-b-0 xl:border-r"
              style={{ borderColor: "var(--ow-border)" }}
            >
              <div
                className="border-b px-4 py-4 md:px-6"
                style={{ borderColor: "var(--ow-border)" }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className="ow-mono text-[9px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--ow-text-dim)" }}
                  >
                    DEFINITION INDEX
                  </span>
                  <span
                    className="ow-mono text-[9px]"
                    style={{ color: "var(--ow-text-muted)" }}
                  >
                    {String(filteredDefinitions.length).padStart(2, "0")} /{" "}
                    {String(definitions.data?.length ?? 0).padStart(2, "0")}
                  </span>
                </div>
                <div className={styles.searchBox}>
                  <span
                    className="ow-mono text-sm"
                    aria-hidden="true"
                    style={{ color: "var(--ow-text-muted)" }}
                  >
                    &gt;
                  </span>
                  <input
                    aria-label="搜索成就"
                    placeholder="SEARCH NAME / KEY / EVENT"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none ow-mono text-[10px]"
                    style={{ color: "var(--ow-text)" }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="清空搜索"
                      className="ow-mono text-xs"
                      style={{ color: "var(--ow-text-muted)" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 p-3 md:p-4 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto">
                {definitions.isLoading && (
                  <EmptyState>LOADING DEFINITIONS...</EmptyState>
                )}
                {definitions.error && (
                  <div
                    role="alert"
                    className="border p-4"
                    style={{
                      borderColor: "var(--danger)",
                      color: "var(--danger)",
                    }}
                  >
                    <p className="ow-mono text-[10px]">
                      加载失败，请检查服务和迁移状态。
                    </p>
                    <button
                      type="button"
                      onClick={() => definitions.refetch()}
                      className={`${dangerButton} mt-3`}
                    >
                      [ RETRY ]
                    </button>
                  </div>
                )}
                {!definitions.isLoading &&
                  !definitions.error &&
                  filteredDefinitions.length === 0 && (
                    <EmptyState>
                      {definitions.data?.length
                        ? "NO MATCHING DEFINITIONS"
                        : "NO ACHIEVEMENTS · CREATE THE FIRST ONE"}
                    </EmptyState>
                  )}
                {filteredDefinitions.map((item, index) => (
                  <DefinitionItem
                    key={item.id}
                    item={item}
                    index={index}
                    active={editing === item.id}
                    onSelect={() => load(item)}
                  />
                ))}
              </div>
            </aside>

            <section aria-label="成就编辑" className="min-w-0">
              <form
                onChange={markDirty}
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(async () => {
                    const rule = currentRule();
                    await validateRule(rule.condition);
                    const saved = await saveAchievement(
                      { ...form, ...rule },
                      editing,
                    );
                    setForm({ ...form, ...rule });
                    setDirty(false);
                    if (!editing && saved?.item?.id) setEditing(saved.item.id);
                    setNotice({ text: "已保存", tone: "success" });
                  });
                }}
              >
                <div
                  className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6"
                  style={{
                    borderColor: "var(--ow-border)",
                    background: "var(--ow-panel-bg-alt)",
                  }}
                >
                  <div>
                    <span
                      className="ow-mono text-[9px] uppercase tracking-widest"
                      style={{ color: "var(--ow-text-muted)" }}
                    >
                      {editing
                        ? `EDITING RECORD #${editing}`
                        : "UNSAVED DEFINITION"}
                    </span>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: "var(--ow-text-mid)" }}
                    >
                      {editing ? form.name : "创建新的成就定义"}
                    </p>
                  </div>
                  <span
                    className="ow-mono text-[9px] uppercase tracking-widest"
                    style={{ color: dirty ? "var(--orange)" : "var(--accent)" }}
                  >
                    {dirty ? "尚未保存" : "已同步"}
                  </span>
                </div>

                <div
                  className="border-b p-4 md:p-6"
                  style={{ borderColor: "var(--ow-border)" }}
                >
                  <SectionHeading
                    index="01"
                    title="IDENTITY / 基础信息"
                    description="KEY 保存后不可修改，用于业务逻辑与数据关联。"
                  />
                  <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-key">
                        稳定标识 KEY{" "}
                        <span style={{ color: "var(--danger)" }}>*</span>
                      </FieldLabel>
                      <input
                        id="achievement-key"
                        aria-label="稳定标识 KEY"
                        required
                        disabled={Boolean(editing)}
                        maxLength={80}
                        className={inputClass}
                        placeholder="FIRST_BLOOD"
                        value={form.key}
                        onChange={(event) =>
                          setForm({ ...form, key: event.target.value })
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-name">
                        名称 <span style={{ color: "var(--danger)" }}>*</span>
                      </FieldLabel>
                      <input
                        id="achievement-name"
                        aria-label="名称"
                        required
                        maxLength={255}
                        className={inputClass}
                        placeholder="首杀"
                        value={form.name}
                        onChange={(event) =>
                          setForm({ ...form, name: event.target.value })
                        }
                      />
                    </div>
                    <div className="min-w-0 md:col-span-2">
                      <FieldLabel htmlFor="achievement-description">
                        描述
                      </FieldLabel>
                      <textarea
                        id="achievement-description"
                        aria-label="描述"
                        rows={3}
                        maxLength={500}
                        className={`${inputClass} resize-y`}
                        placeholder="描述用户达成该成就所需的条件"
                        value={form.description}
                        onChange={(event) =>
                          setForm({ ...form, description: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="border-b p-4 md:p-6"
                  style={{ borderColor: "var(--ow-border)" }}
                >
                  <SectionHeading
                    index="02"
                    title="PRESENTATION / 展示属性"
                    description="颜色和稀有度会用于用户资料与排行榜的成就标签。"
                  />
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-icon">
                        图标（文字 / Emoji）
                      </FieldLabel>
                      <input
                        id="achievement-icon"
                        aria-label="图标（文字 / Emoji）"
                        maxLength={20}
                        className={inputClass}
                        value={form.icon}
                        onChange={(event) =>
                          setForm({ ...form, icon: event.target.value })
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-color">颜色</FieldLabel>
                      <div
                        className={`${styles.colorControl} ${styles.control}`}
                      >
                        <input
                          id="achievement-color"
                          aria-label="颜色"
                          type="color"
                          value={form.color}
                          onChange={(event) =>
                            setForm({ ...form, color: event.target.value })
                          }
                        />
                        <span className="ow-mono text-[10px] uppercase">
                          {form.color}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-rarity">
                        稀有度 0–5
                      </FieldLabel>
                      <input
                        id="achievement-rarity"
                        aria-label="稀有度 0–5"
                        type="number"
                        min={0}
                        max={5}
                        className={inputClass}
                        value={form.rare}
                        onChange={(event) =>
                          setForm({ ...form, rare: Number(event.target.value) })
                        }
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="achievement-order">
                        显示顺序
                      </FieldLabel>
                      <input
                        id="achievement-order"
                        aria-label="显示顺序"
                        type="number"
                        className={inputClass}
                        value={form.sortOrder}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            sortOrder: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div
                    className={`${styles.preview} mt-5`}
                    style={
                      { "--achievement-color": form.color } as CSSProperties
                    }
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center border ow-mono text-xl"
                        style={{
                          borderColor: form.color,
                          color: form.color,
                          background: `${form.color}0D`,
                        }}
                      >
                        {form.icon || "·"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span
                            className="text-sm"
                            style={{ color: form.color }}
                          >
                            {form.name || "成就预览"}
                          </span>
                          <Rarity value={form.rare} color={form.color} />
                        </div>
                        <p
                          className="mt-1 truncate text-[11px]"
                          style={{ color: "var(--ow-text-dim)" }}
                        >
                          {form.description || "成就描述将显示在这里。"}
                        </p>
                      </div>
                      <span
                        className="hidden ow-mono text-[8px] uppercase tracking-widest sm:block"
                        style={{ color: "var(--ow-text-muted)" }}
                      >
                        LIVE PREVIEW
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="border-b p-4 md:p-6"
                  style={{ borderColor: "var(--ow-border)" }}
                >
                  <SectionHeading
                    index="03"
                    title="TRIGGER & RULE / 触发规则"
                    description="先选择事件，再设置达到条件；保存前会自动进行一次规则校验。"
                  />
                  {metadata.isError ? (
                    <div role="alert" className="text-sm">
                      规则选项加载失败。
                      <button
                        type="button"
                        className={neutralButton}
                        onClick={() => void metadata.refetch()}
                      >
                        重试加载
                      </button>
                    </div>
                  ) : metadata.data ? (
                    <RuleEditor
                      key={editorVersion}
                      ref={ruleEditor}
                      type={form.type}
                      condition={form.condition}
                      metadata={metadata.data}
                      onDirty={markDirty}
                    />
                  ) : (
                    <p className="text-xs">正在加载规则选项…</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      className={neutralButton}
                      disabled={busy || !metadata.data || metadata.isError}
                      onClick={() =>
                        void act(async () => {
                          const result = await validateRule(
                            currentRule().condition,
                          );
                          setNotice({
                            text: result.backfillable
                              ? "规则有效，支持历史补发"
                              : "规则有效，依赖瞬时事件，不支持历史补发",
                            tone: "success",
                          });
                        })
                      }
                    >
                      校验规则
                    </button>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--ow-text-muted)" }}
                    >
                      事件决定何时检查；条件决定是否解锁。
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-6">
                  <span
                    className="ow-mono text-[9px] uppercase tracking-widest"
                    style={{ color: "var(--ow-text-muted)" }}
                  >
                    {editing
                      ? `RECORD #${editing} · READY TO UPDATE`
                      : "NEW RECORD · NOT YET SAVED"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {editing && (
                      <button
                        disabled={busy}
                        type="button"
                        className={dangerButton}
                        onClick={() => {
                          if (window.confirm("删除该成就及其全部解锁记录？"))
                            void act(async () => {
                              await deleteAchievement(editing);
                              load(undefined, true);
                              setNotice({ text: "已删除", tone: "success" });
                            });
                        }}
                      >
                        删除
                      </button>
                    )}
                    <button
                      disabled={busy || !metadata.data || metadata.isError}
                      className={primaryButton}
                      type="submit"
                    >
                      {busy ? "[ PROCESSING... ]" : "保存"}
                    </button>
                  </div>
                </div>
              </form>

              {editing && (
                <div
                  className="grid min-w-0 border-t lg:grid-cols-2"
                  style={{ borderColor: "var(--ow-border)" }}
                >
                  <section
                    className="min-w-0 border-b p-4 md:p-6 lg:border-b-0 lg:border-r"
                    style={{ borderColor: "var(--ow-border)" }}
                  >
                    <SectionHeading
                      index="04"
                      title="MANUAL GRANT / 手动授予"
                      description="为指定用户直接解锁当前成就；已有记录不会重复创建。"
                    />
                    <div className={styles.searchBox}>
                      <span
                        className="ow-mono text-sm"
                        aria-hidden="true"
                        style={{ color: "var(--ow-text-muted)" }}
                      >
                        &gt;
                      </span>
                      <input
                        aria-label="搜索用户"
                        placeholder="SEARCH USERNAME / ID"
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        className="min-w-0 flex-1 bg-transparent outline-none ow-mono text-[10px]"
                        style={{ color: "var(--ow-text)" }}
                      />
                    </div>
                    <select
                      aria-label="选择用户"
                      className={`${inputClass} mt-3`}
                      value={target ?? ""}
                      onChange={(event) =>
                        setTarget(
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        )
                      }
                    >
                      <option value="">选择用户</option>
                      {filteredUsers.map((item) => (
                        <option key={item.userId} value={item.userId}>
                          {item.username} #{item.userId}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy || !target}
                      className={`${primaryButton} mt-3`}
                      onClick={() =>
                        void act(async () => {
                          const result = await grantAchievement(
                            editing,
                            target!,
                          );
                          setNotice({
                            text: result.created
                              ? "已授予"
                              : "该用户已解锁，无重复记录",
                            tone: result.created ? "success" : "info",
                          });
                        })
                      }
                    >
                      授予成就
                    </button>
                  </section>

                  <section className="min-w-0 p-4 md:p-6">
                    <SectionHeading
                      index="05"
                      title="HISTORICAL BACKFILL / 历史补发"
                      description="只新增符合条件的记录，不撤回记录，也不会批量弹出通知。"
                    />
                    <p
                      className="mb-3 ow-mono text-[9px] leading-relaxed"
                      style={{ color: "var(--ow-text-muted)" }}
                    >
                      SERVER RESTART REQUIRES A NEW PREVIEW
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      className={neutralButton}
                      onClick={() =>
                        void act(async () =>
                          setJob(await previewBackfill(editing)),
                        )
                      }
                    >
                      预览补发人数
                    </button>
                    {shownJob && (
                      <div role="status" className={`${styles.jobPanel} mt-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className="ow-mono text-[10px] uppercase"
                            style={{
                              color:
                                shownJob.state === "completed"
                                  ? "var(--accent)"
                                  : "#F5D700",
                            }}
                          >
                            {shownJob.state}
                          </span>
                          <span
                            className="ow-mono text-[9px]"
                            style={{ color: "var(--ow-text-muted)" }}
                          >
                            JOB {shownJob.id}
                          </span>
                        </div>
                        <p
                          className="mt-3 ow-mono text-[10px]"
                          style={{ color: "var(--ow-text-dim)" }}
                        >
                          {shownJob.state} · 预计 {shownJob.total} · 已处理{" "}
                          {shownJob.processed} · 新增 {shownJob.created}
                        </p>
                        <div
                          className="mt-3 h-px w-full"
                          style={{ background: "var(--ow-border)" }}
                        >
                          <div
                            className="h-px transition-[width] duration-300"
                            style={{
                              width: `${shownJob.total ? Math.min(100, (shownJob.processed / shownJob.total) * 100) : shownJob.state === "completed" ? 100 : 0}%`,
                              background: "var(--accent)",
                            }}
                          />
                        </div>
                        {shownJob.error && (
                          <p
                            className="mt-3 text-[10px]"
                            style={{ color: "var(--danger)" }}
                          >
                            {shownJob.error}
                          </p>
                        )}
                        {shownJob.state === "preview" && (
                          <button
                            type="button"
                            disabled={busy}
                            className={`${primaryButton} mt-4`}
                            onClick={() =>
                              void act(async () => {
                                const nextJob = await startBackfill(
                                  shownJob.id,
                                );
                                setJob(nextJob);
                                queryClient.setQueryData(
                                  ["achievement-job", nextJob.id],
                                  nextJob,
                                );
                              })
                            }
                          >
                            确认执行补发
                          </button>
                        )}
                      </div>
                    )}
                    {progress.error && (
                      <p
                        role="alert"
                        className="mt-3 border p-3 ow-mono text-[10px]"
                        style={{
                          borderColor: "var(--danger)",
                          color: "var(--danger)",
                        }}
                      >
                        任务不可用或服务重启，请重新预览。
                      </p>
                    )}
                  </section>
                </div>
              )}
            </section>
          </div>
        </div>
      </PanelReveal>
    </main>
  );
}
