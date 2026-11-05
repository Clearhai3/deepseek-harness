# 记忆档案 · memory archive

> 一套「让 agent 记得你」的档案格式 + 一个 DSH 插件（10 个工具）。
> 这份文件写的是**出厂状态**：这套东西是什么、怎么长出你的那一份。**不含任何人的私人记忆** —— 那些在 `about.md` 和 `journal/` 里。

## 一、它解决什么

模型的上下文每次会话都会重来。于是所有"关于你"的东西必须落在磁盘上，且要能在**正确的时机、以正确的权限**被读出来。

两件东西分开：**档案**（一堆 markdown + 一张地图）和**插件**（按地图读写的工具）。人不学工具，工具不猜人。

## 二、最小骨架（`archive_init` 写完的样子）

```
<archive-root>/
├── archive.yaml          # 地图：有哪些区块、在哪、AI 能写什么、人改之前怎么提醒
├── AGENTS.md             # 手册：红线 / 工具用法 / 记录习惯 + 待填的实例槽
├── README.md             # 本文件：出厂说明
├── about.md              # 关于我：我是谁 / 在做什么 / 希望 AI 怎么配合（待填）
└── notes/
    └── 2026-11-05.md     # 当天第一页，空壳
```

然后模型问两三句，把 `about.md` 与 `AGENTS.md` 的**实例槽**（关于用户 / 当前状态 / 我犯过的错）填上。

## 三、长成之后（一个用了三个月的档案）

```
<archive-root>/
├── archive.yaml
├── AGENTS.md             # 手册（每轮注入给模型）
├── README.md
├── SELF.md               # 立场、犯过的错
├── todo.md               # 待办，一行一条
├── temp.md               # 限时记忆（3/9/15/30 天分档）
├── longterm.md           # 长期记忆（满 30 天迁入，保留不删）
├── about.md
├── journal/2026-11/2026-11-05.md      # 逐日日志，一天一页
├── memory/                            # 专题记忆
├── design/                            # 项目设计
├── conversations/                     # 深聊存档
└── archive/                           # 更早的阶段日志（冻结，只读）
```

## 四、地图语法

```yaml
version: 2
trail: journal            # soft 区块被改时，⭐ 留痕写进哪个 append 区块
sections:
  - name: journal         # 区块名（工具里就这么叫它，别猜）
    path: journal/        # 尾斜杠 = 目录区块；否则是单文件
    kind: append          # append / reference / always-loaded / frozen
    level: free           # 防 AI：gated 需批 / soft 可改但留痕 / free 随便写
    warning: none         # 防人：strong 强警告 / light 轻提醒 / none 不提醒
    layout: daily         # append 可以是 daily（一天一页）或 single（单文件）
    description: 逐日日志
```

- `kind` 管**位置与重要程度**：`always-loaded` 每轮注入、`append` 只增、`reference` 按需读、`frozen` 只读。
- `level` 与 `warning` **是两列、方向相反**：一个管 AI 的手，一个管人的眼。`level` 没有 `frozen`，`kind` 才有。
- 标签格式：`⭐`（可选，表示重要）+ 一个分类（打卡 / 落地 / 踩坑 / 决策 / 对话）+ 一个领域词 + 0~2 个自由词。

## 五、十个工具

| 工具 | 干什么 |
|---|---|
| `archive_list` | 列出所有区块（大小、等级、种类）—— **每次开局第一步** |
| `archive_check` | 按时间范围 + 标签找条目，只返回摘要（不搜正文） |
| `archive_read` | 读一个区块，或目录区块里的一个文件 |
| `archive_append` | 往 append 区块记一笔（时间与人自动盖） |
| `archive_edit` | 精确替换一处文本（必须唯一匹配；soft 区块留 ⭐ 痕） |
| `archive_time` | 档案时钟；算「距上次多久」 |
| `archive_due` | 哪些限时记忆到了 3 / 9 / 15 / 30 天，或 `起始` 坏了 |
| `archive_promote` | 把满 30 天的 temp 条目迁进 longterm（先写后删） |
| `archive_init` | 在空目录建最小骨架；地图已存在则拒绝 |
| `archive_map_write` | 整份替换地图 —— **每次写入都先给人看 diff、等人批** |

## 六、出厂流程（自动的多，人工的少）

1. `archive_init` 写骨架：地图 + `AGENTS.md`（手册骨 + 空实例槽）+ `README.md` + `about.md`（空槽）+ 当天第一页；
2. 模型问用户两三句（怎么称呼、在做什么、希望怎么配合），把 `about.md` 与手册的**实例槽**填上；
3. 人只做两件事：**看一眼 diff**、**把需要人签的那几处签掉**（地图写入、沙箱外路径）。

骨 → 程序，肉 → 一两句问答。这就是"人工参与很少"的全部含义。

## 七、重建一个档案（换机 / 新用户）

1. 把档案目录拷过去（或 `git clone`）；
2. 插件挂上去：DSH profile 里加插件行，`DSH_PROFILE` 指向那份 profile；
3. 确认沙箱：写档案目录要 `workspace-write` 起步；写 `~/.dsh` 一律**人来做**（那是权限表之外的地盘）；
4. 开新会话，`archive_list` 能列出区块 = 通了。

> ⚠️ 不能自动的部分，别装作能：改地图（权限表）、写 profile（在家门之外）、重启应用。

## 八、看设计

| 想知道什么 | 去哪 |
|---|---|
| 插件怎么设计的（10 个工具、闸门、外部改动检测、冻结清单） | `design/档案插件设计.md` |
| 值怎么从档案流到运行时（四层 / 生成链） | `design/设置架构.md` |
| DSH 的沙箱与审批怎么调 | `design/DSH权限模型.md` |
| 给模型看的手册（红线 / 用法 / 记录习惯） | `AGENTS.md` |
