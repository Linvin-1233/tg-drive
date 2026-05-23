# tg-netdisk

基于 Telegram Bot + Next.js 的私人 / 家庭网盘系统

---

## 1. 如何使用

### 1. Fork 项目
1. fork 此仓库到你的 GitHub

---

### 2. 部署到 Vercel
2. 在 Vercel 后台导入项目

![vercel主页面](README/images/1.png)  
![导入](README/images/2.png)

---

### 3. 创建 Telegram Bot 与群组
3. 在 Telegram BotFather 创建机器人（此处不演示）

4. 创建 Telegram 群组，并在群组内发送消息
    - 推荐：5 个群组（提升上传性能）
    - 最少：3 个群组

---

### 4. 获取群组 ID
5. 访问：

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

示例返回：

```json
{
  "chat": {
    "id": -100....., //这里是你的群组id
    "title": "你的群组",
    "type": "supergroup"
  }
}
```

---

### 5. Cloudflare 配置

6. 获取 Cloudflare 账户 ID

![account](README/images/img.png)

---

### 6. 创建 D1 数据库

7. 创建 D1 SQL 数据库

![sql](README/images/img_1.png)

执行 SQL：

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT,
  extension TEXT,
  size INTEGER,
  cdn_urls TEXT,
  folder_id TEXT,
  urls_expired_at INTEGER,
  channel_id TEXT,
  message_id INTEGER
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_locked INTEGER DEFAULT 0,
  password_hash TEXT
);
```

---

### 7. 获取 D1 API

![copy](README/images/img_3.png)

---

### 8. 创建 Cloudflare API Token

![api token](README/images/img_4.png)  
![bruh](README/images/img_5.png)

---

### 9. 配置环境变量

```env
CF_ACCOUNT_ID=          # 你的cloudflare账户id
CF_D1_DATABASE_ID=      # 你的D1 SQL数据库id
CF_API_TOKEN=           # 你的cloudflare api令牌
TELEGRAM_BOT_TOKEN=     # 你的telegram bot令牌
TELEGRAM_GROUP_IDS=     # 你的telegram群组id，通过英文逗号分隔。最后一个群组切记不要逗号结尾。如：-100xxx,-150xxx,-123xxx,-502xxx
ADMIN_USERNAME=         # 登录网盘时的用户名
ADMIN_PASSWORD=         # 登录网盘时的密码
```

---

### 10. Vercel 配置

在 Vercel → Environment Variables 中填入上述内容

![q](README/images/img_6.png)

---

### 11. 完成部署

访问你的网盘系统即可使用

---

## 2. 开发

```bash
git clone https://github.com/Linvin-1233/tg-netdisk.git
```

```bash
cd tg-netdisk
```

```bash
npm install
```

启动开发：

```bash
npm run dev
```

访问：

```
http://localhost:3000
```

---

## 3. 其他

- 如遇 Bug / 建议，请提交 Issue
- 本项目仅用于技术实现与学习用途，请遵守当地法律法规及 Telegram 平台条款
- 因使用本项目导致的账号封禁 / 群组限制 / 数据损失，开发者不承担责任
- 用户行为由用户自行负责
- 不建议用于商业化文件托管服务或大规模公共存储平台，请遵守 Telegram 使用规范