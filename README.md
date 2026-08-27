# 空洞骑士系列 · 收藏品存档解析与修改器

《空洞骑士》与《空洞骑士：丝之歌》双存档解析 + 修改工具。全部在本机浏览器内完成，不上传任何数据。

## 功能

- **收藏解析**：空洞骑士（古董、面具碎片、容器碎片、苍白矿石等）、丝之歌（面具碎片、灵丝轴碎片、忆境纪念盒、迷途跳蚤、制造金属、圣咏音筒、丝之心、苔莓等）。
- **存档修改**：
  - 钢魂碎档修复（空洞骑士与丝之歌均支持）：`permadeathMode` 碎档(2/`"Dead"`)后改回钢魂(1)或普通(0)，清零死亡计数、解除死亡状态。
  - 修改吉欧/货币、游戏时长、血量/面具数量。
  - 高级 JSON 编辑器：可改任意字段。
  - 导出：重新加密为 PC 版 `.dat`，或导出明文 `.json`。

## 在线访问

本项目作为 GitHub Pages 项目站部署（仓库名 = 项目名）：

- **GitHub Pages（主站）**：`https://<你的用户名>.github.io/hollow-knight-silksong-save-editor/`
- **国内加速镜像（jsDelivr CDN）**：`https://cdn.jsdelivr.net/gh/<你的用户名>/hollow-knight-silksong-save-editor@main/index.html`

说明：`github.io` 域名走 Fastly CDN（含亚洲节点），国内一般可直接访问；若个别地区不稳定，可用上方的 jsDelivr 镜像（国内节点更稳）。为固定版本可使用发布 tag，例如 `@v1.0.0`。

## 本地使用

双击 `启动工具.cmd`，或直接用现代浏览器打开 `index.html` 即可（全程离线可用）。

Windows 常见存档位置：
- 空洞骑士：`%USERPROFILE%\AppData\LocalLow\Team Cherry\Hollow Knight\`
- 丝之歌：`%USERPROFILE%\AppData\LocalLow\Team Cherry\Hollow Knight Silksong\`

## 部署

推送到 GitHub 的 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动发布到 GitHub Pages（需在仓库 Settings → Pages 里将 Source 设为 **GitHub Actions**）。

```
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你的用户名>/hollow-knight-silksong-save-editor.git
git push -u origin main
```

## 注意

修改前请务必备份原档；修改存档可能导致成就失效或进度异常，后果自负。

数据/代码依据：
- 空洞骑士&丝之歌中文维基（收集位置）：https://hkss.huijiwiki.com/wiki/首页
- ReznoRMichael/HK Save Analyzer (GPL-3.0)
- bloodorca/hollow（加解密格式）：https://github.com/bloodorca/hollow
- langstonstewart/silksong-completion-analyzer（字段映射，MIT License）
