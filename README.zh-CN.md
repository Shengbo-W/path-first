# path-first

**让你的 coding agent 可以反对你的路径，而不是反对你的目标。**

[English](README.md)

---

你说："去日志里 grep 一下这个报错，然后读它指向的那个文件。"

agent 照做了。日志 40 MB，报错那一行没带文件指针。它仍然给了一份看着挺像回事的总结，然后你花了十分钟才发现这条路从一开始就走不通。

没有任何东西坏掉。它精确地执行了你说的每一个字。这就是失效本身。

人会把**目标**和**路径**放在同一句话里，并不标注哪层是哪层。多数 agent 把两层都当命令执行。讲礼貌的那些会走完那条差路，再补一句"其实有更简单的做法"——那是汇报，不是决策。

`path-first` 做的事，就是在第一次动手之前多问一句：

> 我走这条路，是因为它最优，还是因为它被点名了？

如果是被点名，它还有一句话的时间，在动手前说出来。

## 规则要求的具体动作

第一次调用工具之前，默默问四个问题：

1. 这是目标，还是路径？
2. 他点的那条路，对这个环境、你手上已有的东西，真的是最优吗？
3. 更优路径的代价是什么——可逆吗？更省吗？更少步吗？还能到达目标吗？
4. 用户会在意吗？会改变他在意的东西的路径，是问题，不是决定。

然后是四种动作之一：

| 情况 | 动作 |
| --- | --- |
| 他点的路已经是最优 | 照走，不加评论。 |
| 判断不了（信息缺失、环境未知） | 照走，用一行说明不确定在哪。 |
| 更优路径需要他的凭据、批准，或要改目标 | 照走，用一行点明是哪一种。 |
| 明确存在更优路径 | **动手前**一句话说出。差距小：直接换，半句话带过。差距大或那条路会失败：给出替代，同时继续推进。 |

还有一条纪律，防止它变成爱插嘴的助手：**每个任务只提一次**，被拒绝就永久放下；并且有硬开关——"直接做"、"别问了"、"严格按我的步骤来"，一律关闭检查。

规则里还写明了它要抓的失效：字面服从、把例子当约束、工具名引力、把句子顺序当依赖、重造已有的东西、默认串行、迟到的诚实。

## 安装

零依赖，Node 18+。

```bash
# 直接从 GitHub 装，不用等发版
npm i -D github:Shengbo-W/path-first
npx path-first init
```

或者直接克隆下来跑脚本：

```bash
git clone https://github.com/Shengbo-W/path-first.git
node path-first/bin/path-first.mjs init --cwd /path/to/your/project
```

`init` 会在你指定目录的 `AGENTS.md` 里追加一个托管块——Codex、Cursor、Gemini CLI、Zed、Aider 等大多数 agent 本来就会读这个文件。用了上面的 npm 安装方式，本文后面所有命令都可以照写。

```bash
path-first init --lang zh            # 中文版规则
path-first init --target skill --dir ~/.claude/skills   # 同时装一份 SKILL.md
path-first init --dry-run            # 只看不改
path-first check                     # 缺失或被手改过则 exit 1
path-first print --lang zh           # 只打印规则正文
path-first remove                    # 卸载，保留你自己的内容
path-first targets                   # 看会装到哪里
```

不想用 npx？把 [`rules/path-first.zh-CN.md`](rules/path-first.zh-CN.md) 手动贴进你的 `AGENTS.md`；或者把 [`skills/path-first`](skills/path-first) 整个目录拷到你的 skills 目录下。

### 装到哪里

| 目标 | 文件 |
| --- | --- |
| `agents`（默认） | 当前目录的 `AGENTS.md` |
| `skill` | `<dir>/path-first/SKILL.md`，完整规则在 `references/` 下 |

托管块用 HTML 注释包起来并带校验和，所以 `check` 能区分"干净安装"和"被手改过"；重复执行是升级文本，不会重复插入。`remove` 只删这个块，绝不碰你自己的规则。

OpenViking（`viking://~/skills`）用 `--target skill --dir <skills 目录>` 安装，或用 `add_skill` 工具 / `ov` CLI 导入该目录。

## 它真的有用吗

它是提示词，不是联锁装置。模型仍可能字面服从；这条规则提高的是基线，并且改变 agent 会不会把话说出口。三个可以试的提示：

1. **不可行的路径。**"用 `jq` 解析这个文件"——文件其实是 `.docx`。没有规则时，agent 会硬凑一条不可能成功的 `jq` 管道；有规则时，它会说这是 zip 容器，然后换个工具。
2. **冗余的路径。**"把 `src/*.ts` 一个个读完，找出 `createUser` 定义在哪。"有规则时，一次 `grep` 代替四十次读取，并用半句话说明。
3. **代价高的路径。**"先跑迁移，schema 待会儿再看。"有规则时，它会先问备份——只问一次。

如果三个都照做，说明规则装上了但没被读到：确认你的 harness 确实会加载 `AGENTS.md`，或者改用 skill 方式安装。

## 它不是什么

- 不是 linter、不是沙箱、不是权限系统。它改变的是 agent 动手前的说话方式；真正的护栏还归你。
- 不是重新设计你的需求。第 5 节把"更优"定义得很窄：目标不变、更少不可逆操作、更少步骤、更低成本、结果不差。口味之争不算更优，规则要求闭嘴。
- 不替代工作流引擎。需要确定性就把步骤写进代码；这条规则负责的是开放的那部分。

## 文件

```
rules/path-first.md            规则正文（英文）
rules/path-first.zh-CN.md      规则正文（中文）
skills/path-first/SKILL.md     精简版，给按 skill 加载的 harness
bin/path-first.mjs             安装器（零依赖）
test/cli.test.mjs              node --test
```

## 许可

MIT。拿去用、fork、翻译，或者直接抄进你自己的 `AGENTS.md`。
