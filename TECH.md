# 方案 1 技术设计

## 页面与资源

- `index.html` 来自本对话已验证的 `incremental-form.html`；Vue 3.5.13、Ant Design Vue 4.2.6、Day.js 1.11.13 均使用本地副本。
- 页面样式、业务逻辑、SVG 图标内嵌于 HTML，无构建工具和真实接口。
- `assets/`、采集原始页及资源清单从原目录复制，保留来源；不使用符号链接，其他方案修改不会影响本目录资源。
- 二级部门以 `a-tree-select` 还原 DeptTreeSelect；基准城市为单选 `a-select`，档位名称 `a-input`，系数 `a-input-number`，城市多选 `a-select`。
- 编辑时部门树选择与国家选择均使用Ant Design Vue的disabled状态，复用同一套禁用样式；国家不再使用自定义只读div。

## 数据结构与隔离

- 方案按 `JSON.stringify([department, id])` 唯一识别；包含 `department`、国家 `id`、`enabled`、`baseCity`、`tiers`。
- `baseCity` 空字符串代表国家标准。`tiers` 是有序数组，每项 `{ uid, name, factor, cities }`，uid用于稳定渲染和焦点定位。
- 本目录使用独立键 `hrone-city-rules-config-only-v1`，不写原部门版键、国家版键或完整流程大表键。
- 首次无独立数据时，依次读取 `hrone-prototype-city-salary-rules-department-v2`、`hrone-prototype-city-salary-rules-v1`，再回退内置数据；将旧固定档位转换为数组，补齐部门和空基准，并保存独立副本。
- 浏览器禁止存储时可使用内置或读到的配置演示；用户保存失败会反馈错误。
- 列表展示固定的“基准城市”“档位：系数”列。基准空值显示国家标准；按有序tiers数组拼接档名与格式化系数，不改写配置值。
- 删除仅从独立规则对象中移除当前部门、国家的键；localStorage写入成功后才更新内存列表。保留空对象`{}`，不移除存储键，避免刷新后触发首次导入、恢复已删除方案。
- 删除确认使用`Modal.confirm`，通过onOk的close回调在持久化成功后关闭；失败保留弹窗供重试。删除后按筛选结果重新限制当前页范围，不变更查询条件。

## 迁移验证

- 迁移前后对照代码，预期变化仅为独立存储键及一次性兼容导入逻辑。
- 核对所有本地脚本/样式引用、资源文件校验值；复核动态档位保存及新旧存储隔离；通过本地 HTTP 服务预览。

## 页面交互优化（2026-11-24）

- 查询表单绑定`:model="filters"`，由`finish`统一驱动查询按钮和回车提交；修复无model时不触发查询的问题。
- 主表通过连续的`fixed: 'left'`固定部门、国家，并固定右侧操作列；“档位：系数”合并文本允许换行展示长名称。
- 编辑使用现有custom-modal样式，正文限制高度并滚动；校验后的nextTick定位首个错误控件，不增加新的表单框架或数据字段。
- `tests/browser.cjs`使用隔离Playwright上下文验证真实UI，不读取用户浏览器配置；包括查询、空态、编辑校验、长表单、新增、保存失败恢复、持久化、存储隔离及表格横向滚动。

## GitHub Pages 部署

- 独立 Git 仓库：`https://github.com/johnnyhcm/zt-cr-city-solution1`。
- Pages 地址：`https://johnnyhcm.github.io/zt-cr-city-solution1/`。
- 从 `main` 分支根目录发布，无编译步骤；`.nojekyll` 让静态资源按原目录直接部署。
- 页面资源使用相对路径，兼容 Pages 项目子路径；运行数据仍使用浏览器 localStorage。
- 本地端口与线上域名的存储相互独立；同一 GitHub Pages 域名下，本方案继续使用独立存储键。
- 后续更新在本目录提交并推送至 `main`，由 GitHub Pages 自动重新部署。
