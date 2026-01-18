---
description: shadcn/ui 组件库使用规范
globs: "**/*.tsx,**/*.ts"
alwaysApply: true
---

# shadcn/ui 组件库使用规范

本项目使用 [shadcn/ui](https://ui.shadcn.com) 作为 UI 组件库。

## 项目配置

- **风格**: new-york
- **基础颜色**: neutral
- **图标库**: lucide-react
- **CSS 变量**: 启用
- **RSC**: 支持 React Server Components

## 目录结构

```
├── components/
│   └── ui/           # shadcn/ui 组件存放目录
├── lib/
│   └── utils.ts      # cn() 工具函数
├── app/
│   └── globals.css   # 全局样式和 CSS 变量
└── components.json   # shadcn/ui 配置文件
```

## 添加组件

使用 CLI 添加新组件：

```bash
# 添加单个组件
npx shadcn@latest add button

# 添加多个组件
npx shadcn@latest add button card dialog

# 查看所有可用组件
npx shadcn@latest add
```

## 组件使用

### 导入路径

```tsx
// 从 @/components/ui 导入组件
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
```

### cn() 工具函数

使用 `cn()` 合并 Tailwind 类名：

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive && "bg-primary")} />
```

### 图标使用

项目使用 `lucide-react` 作为图标库：

```tsx
import { Search, Menu, X } from "lucide-react"

<Button>
  <Search className="mr-2 h-4 w-4" />
  搜索
</Button>
```

## 主题定制

### CSS 变量

主题变量定义在 `app/globals.css` 中：

- `--background` / `--foreground`: 背景和前景色
- `--primary` / `--primary-foreground`: 主色调
- `--secondary` / `--secondary-foreground`: 次要色调
- `--muted` / `--muted-foreground`: 柔和色调
- `--accent` / `--accent-foreground`: 强调色
- `--destructive`: 危险/删除操作色
- `--border` / `--input` / `--ring`: 边框和交互色
- `--radius`: 圆角大小

### 深色模式

项目支持深色模式，通过 `.dark` 类切换：

```tsx
// 切换深色模式
document.documentElement.classList.toggle('dark')
```

## 常用组件示例

### Button

```tsx
import { Button } from "@/components/ui/button"

<Button variant="default">默认</Button>
<Button variant="secondary">次要</Button>
<Button variant="outline">轮廓</Button>
<Button variant="ghost">幽灵</Button>
<Button variant="destructive">危险</Button>
<Button size="sm">小</Button>
<Button size="lg">大</Button>
```

### Form 表单

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="grid gap-2">
  <Label htmlFor="email">邮箱</Label>
  <Input id="email" type="email" placeholder="请输入邮箱" />
</div>
```

### Card 卡片

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述信息</CardDescription>
  </CardHeader>
  <CardContent>
    内容区域
  </CardContent>
</Card>
```

## Modal/Dialog 宽度规范

**重要：本项目所有 Modal/Dialog 弹窗统一使用 85vw 宽度。**

Dialog 组件（`components/ui/dialog.tsx`）已配置默认宽度：

```tsx
// DialogContent 默认样式
w-[85vw] max-w-[85vw] max-h-[90vh] overflow-y-auto
```

### 使用说明

1. **直接使用** - 无需额外指定宽度，组件默认为 85vw
2. **高度限制** - 最大高度 90vh，超出自动滚动
3. **不要覆盖宽度** - 保持系统统一性，禁止在各页面单独设置 Dialog 宽度

### 示例

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>标题</DialogTitle>
    </DialogHeader>
    {/* 内容 */}
  </DialogContent>
</Dialog>
```

## 最佳实践

1. **优先使用 shadcn/ui 组件** - 保持 UI 一致性
2. **不要直接修改 `components/ui` 中的组件** - 如需定制，创建包装组件
3. **使用 cn() 合并类名** - 避免类名冲突
4. **遵循 Tailwind CSS 规范** - 使用预定义的设计令牌
5. **保持深色模式兼容** - 使用 CSS 变量而非硬编码颜色
6. **Modal 宽度统一 85vw** - 不要在页面中覆盖 Dialog 宽度

## 相关链接

- [shadcn/ui 官方文档](https://ui.shadcn.com)
- [组件列表](https://ui.shadcn.com/docs/components)
- [主题定制](https://ui.shadcn.com/docs/theming)
- [Lucide 图标](https://lucide.dev/icons)
