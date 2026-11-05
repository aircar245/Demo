# Demo

CNSS 2026 招新平台前端演示。首页的彩色光标会绘制边框、输入文字，并逐格组装统计轨道。右上角可以重播或跳过动画。

Netlify 从仓库根目录执行 `npm run build` 并发布 `.next`，由 Netlify 的 Next.js 适配器处理动态路由。演示的 API 和 NSCC 地址使用 `https://example.com`。登录、报名和实时榜单等功能需要配置真实后端。

本地预览可以先将 `.env.local.example` 复制为 `.env.local`，再安装依赖并启动。

```sh
npm ci
npm run dev
```
