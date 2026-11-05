'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 移动端左栏抽屉 — 从左侧滑入，覆盖页面内容
 *
 * 断点约定（必须一起维护）：
 *   - 遮罩/抽屉本体：`lg:hidden`（768–1024px 平板段可渲染）
 *   - 触发按钮（FILTER）：父级传入，使用 `md:hidden`（768px 以上隐藏按钮）
 *   - 左栏内联：父级 PanelReveal 使用 `hidden md:flex`
 *
 * 以上三者配合确保：
 *   < 768px   → 左栏隐藏，FILTER 按钮可见，抽屉可打开
 *   768–1024px → 左栏内联显示，FILTER 按钮隐藏，抽屉不可触发（按钮不见）
 *   > 1024px   → 左栏内联显示，FILTER 按钮隐藏，抽屉强制隐藏
 *
 * 若修改任一断点，需同步修改其他两处。
 */
export function SidebarDrawer({ open, onClose, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 半透明遮罩 */}
          <motion.div
            key="drawer-backdrop"
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* 抽屉本体 */}
          <motion.div
            key="drawer-panel"
            className="fixed top-12 left-0 bottom-0 z-50 w-[240px] flex flex-col lg:hidden overflow-y-auto"
            style={{ background: 'rgba(10,10,10,0.98)', borderRight: '1px solid #2A2A2A' }}
            initial={false}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
