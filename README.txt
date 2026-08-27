空洞骑士系列 · 收藏品存档解析与修改器

双击“启动工具.cmd”（或直接用现代浏览器打开 index.html），选择《空洞骑士》
或《空洞骑士：丝之歌》的 user*.dat。工具会自动识别游戏，全部在本机浏览器内完成。

功能：
- 收藏解析：逐项核对古董、面具碎片、容器碎片、苍白矿石、迷途跳蚤、强化物等。
- 存档修改（“存档修改”标签页）：
  · 钢魂碎档修复：把 permadeathMode 改回钢魂(1)或普通(0)，并归零死亡计数。
  · 修改吉欧/货币、游戏时长、血量/面具数量（空洞骑士含基础面具、当前血量、
    最大血量与蓝血；丝之歌为最大血量）。
  · 高级 JSON 编辑器：可任意修改其余字段（灵魂、护符、纳骨堂等）。
  · 导出：按原格式重新加密为 PC 版 .dat，或导出明文 .json。

Windows 常见存档位置：
空洞骑士：%USERPROFILE%\AppData\LocalLow\Team Cherry\Hollow Knight\
丝之歌：%USERPROFILE%\AppData\LocalLow\Team Cherry\Hollow Knight Silksong\

注意：修改前请务必备份原存档。存档修改可能导致成就失效或进度异常，后果自负。

数据/代码依据：
- 空洞骑士&丝之歌中文维基（收集位置）：https://hkss.huijiwiki.com/wiki/首页
- 空洞骑士中文 Wiki（本地物品图片来源，CC BY-SA）：https://hollowknight.fandom.com/zh/wiki/物品
- ReznoRMichael/HK Save Analyzer (GPL-3.0)
- bloodorca/hollow（加解密格式）：https://github.com/bloodorca/hollow
- langstonstewart/silksong-completion-analyzer（字段映射，MIT License）
