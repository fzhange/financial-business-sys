# Project Context

## Purpose
业务财务系统 (Financial Business System) - 一个面向企业的财务管理平台，用于实现供应商对账付款的全流程闭环管理。核心功能包括采购入库/退货记录、供应商对账、应付账款管理、发票管理、请款审批和付款核销等关键模块。

## Tech Stack
- **框架**: Next.js 16.1.3 (App Router, React Server Components)
- **前端**: React 19.2.3, TypeScript 5
- **样式**: Tailwind CSS 4, CSS Variables
- **UI 组件库**: shadcn/ui (new-york 风格, neutral 基础色)
- **图标库**: lucide-react
- **工具库**: clsx, tailwind-merge, class-variance-authority
- **数据存储**: 本地 JSON 文件模拟数据库
- **代码规范**: ESLint (eslint-config-next)

## Project Conventions

### Code Style
- 使用 TypeScript 严格模式 (`strict: true`)
- 使用 `@/*` 路径别名引用项目内模块
- UI 组件放置在 `components/ui/` 目录
- 工具函数放置在 `lib/` 目录
- 使用 `cn()` 工具函数合并 Tailwind 类名
- 使用中文作为开发沟通和注释语言

### Architecture Patterns
- **前端**: Next.js App Router + React Server Components
- **后端**: Next.js API Routes (`app/api/`)
- **数据层**: JSON 文件存储 (`data/` 目录)
- **组件设计**: 优先使用 shadcn/ui 组件，保持 UI 一致性
- **深色模式**: 支持通过 `.dark` 类切换

### Testing Strategy
- 使用 ESLint 进行代码质量检查
- 开发时使用 `npm run dev` 进行实时预览验证

### Git Workflow
- 主分支: `main`
- 使用 OpenSpec 管理变更提案和规格文档
- 变更提案存放在 `openspec/changes/` 目录

## Domain Context
- **供应商对账付款流程**: PO → 发货 → 收货/退货记录 → 对账单 → 发票 → 请款 → 付款 → 核销
- **核心实体**: 
  - 采购入库/退货记录 (purchase-record)
  - 供应商对账单 (supplier-statement)
  - 应付账款 (accounts-payable)
  - 发票管理 (invoice-management)
  - 请款管理 (payment-request)
  - 付款单 (payment-order)
  - 核销管理 (write-off)

## Important Constraints
- 数据库使用本地 JSON 文件模拟，非生产级持久化方案
- 服务端逻辑通过 Next.js API Routes 实现
- 需要保持 shadcn/ui 组件一致性，不直接修改 `components/ui` 中的原始组件

## External Dependencies
- 无外部 API 依赖，完全自包含的本地开发环境
- 使用 npm 作为包管理器
