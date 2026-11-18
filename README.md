# 方案 1：仅配置城市规则

本目录为本对话的独立工作目录，迁移于2026-11-18。后续城市规则配置优化均在本目录继续。

## 预览

线上地址：[GitHub Pages](https://johnnyhcm.github.io/zt-cr-city-solution1/)。

代码仓库：[zt-cr-city-solution1](https://github.com/johnnyhcm/zt-cr-city-solution1)。推送到 `main` 后自动发布。

当前本机地址：`http://127.0.0.1:4177/index.html`。

需要重新启动时，在本目录运行：

```sh
python3 -m http.server 4177 --bind 127.0.0.1
```

## 内容

- `index.html`：原已验证的 `incremental-form.html`，包含部门查询、基准城市和动态档位配置。
- `assets/`：独立本地运行依赖，不与其他方案共用文件。
- `DISSCUSION.md`：本对话已确认的结论与迁移决定。
- `PRD.md`：当前功能、线框、校验及验收范围。
- `TECH.md`：本地实现、数据结构及浏览器存储隔离。
- `TODO.md`、`ISSUE_LOG.md`：实施状态与并行修改问题记录。
- `AGENTS.md`：本目录后续操作边界。
- `screenshots/`：第一次部门更新、第二次基准城市与动态档位更新的验证截图。
- `source/index.original.html`、`resources.json`：保留初版采集参考与依赖来源清单，不作为当前业务页面执行。

## 范围与数据

测试部门为“LBU速运事业部”；可维护部门、国家、启用状态、可清空基准城市及自定义档位。保存只更新配置。

浏览器配置使用独立键 `hrone-city-rules-config-only-v1`；首次可导入同一浏览器来源下的旧测试配置，之后独立保存。打开不同端口时浏览器存储相互独立，初始按可用旧配置或内置德国、法国示例展示。

完整执行预览、批量刷新及大表写入属于其他方案，不包含在本目录。

## 验证

静态检查无错误或警告；脚本和样式引用全部为目录内现存文件，复制资源校验值一致；保存、刷新、基准清空、档位增删及旧配置首次导入通过检查，新方案保存不改旧键或大表数据；独立HTTP地址已在浏览器成功打开。
