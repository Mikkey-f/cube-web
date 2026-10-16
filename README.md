# CUBE 计算机联合成长实验室官网

前后端分离架构：React + Three.js 前端，Spring Boot + JWT 后端。

## 项目结构

```
Cude-Web/
├── frontend/          # React 18 + Vite + TS + Three.js
│   └── public/logo.jpg
└── backend/           # Spring Boot 3（Java 17）+ Spring Security + JWT + H2
    ├── data/          # H2 数据库文件（运行时自动生成）
    └── uploads/       # 简历 PDF 存储目录（运行时自动生成）
```

## 本地启动

### 后端（端口 8080）

真实配置 `application.yml` 含密钥，**不入库**，首次运行先复制模板：

```powershell
Copy-Item backend/src/main/resources/application-example.yml backend/src/main/resources/application.yml
mvn -f backend/pom.xml spring-boot:run
```

> 启动时必须显式指定端口（环境可能注入 `server.port` 覆盖配置文件）：
> `mvn -f backend/pom.xml spring-boot:run "-Dspring-boot.run.arguments=--server.port=8080"`

首次启动会自动创建 `application.yml` 里 `app.admin` 配置的管理员账号。
**上线前务必**改掉 `jwt-secret` 和管理员密码。

### 前端（端口 5173）

```powershell
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 ，前端通过 Vite 代理将 `/api` 转发到 8080。

## 功能

| 角色 | 功能 |
|------|------|
| 游客 | 浏览首页（3D 立方体动画、实验室介绍、技术方向、招新入口） |
| 普通用户 | 注册 / 登录 → 提交报名（表单 + PDF 简历，每个账号限一次）→ 查看自己的报名 |
| 管理员 | 登录 → 后台查看所有投递列表、下载简历 PDF |

## API 一览

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册（返回 JWT） | 公开 |
| POST | `/api/auth/login` | 登录（返回 JWT） | 公开 |
| POST | `/api/applications` | 提交报名（multipart：realName/studentId/phone/intro + resume 文件） | USER |
| GET | `/api/applications/me` | 查看自己的报名（未提交返回 204） | USER |
| GET | `/api/admin/applications` | 投递列表 | ADMIN |
| GET | `/api/admin/applications/{id}/resume` | 下载简历 | ADMIN |

## 技术决策

- **认证**：JWT（HS256），token 中携带角色，后端无状态校验
- **数据库**：开发期 H2 文件库（零安装）；上线切 MySQL 只需改 `application.yml` 的 datasource 并引入驱动
- **简历存储**：文件落盘 `uploads/`（UUID 命名），数据库只存路径和原始文件名
- **每人限报一次**：`applications.user_id` 唯一约束，后端先查后写
