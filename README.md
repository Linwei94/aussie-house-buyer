# 🏡 澳洲首套买房计算器 · Aussie Home Buyer

为赴澳/在澳华人量身做的买房决策助手。

**在线使用**：https://linwei94.github.io/aussie-house-buyer/

## 功能

- NSW 印花税梯度 + FHBAS 全免/部分减免/$1M 悬崖识别
- First Home Guarantee（FHG）资格判断 + LMI 自动估算
- FHOG 新房补助
- 月供（30 年 P&I）+ 持有成本（strata / council / 水 / 保险 / 维护）
- **细化的卖出成本**：中介佣金 % + 营销费 + 律师 + discharge + 拍卖师 + staging
- N 年盈亏平衡价 + 需要的房价年化涨幅
- 买房 vs 租房+ETF 资产对比图
- **手动输入具体房产数据**（周租金 / strata / council / suburb 涨幅），覆盖默认估算
- 政策提示徽章（FHBAS 全免、$800K/$1M 悬崖警告、自住 12 个月连住要求等）

## 路线图

- [ ] **Agent 自动获取房产数据**：粘贴 realestate.com.au / domain.com.au 链接，自动抓取叫价、估算周租金、strata、council、同区涨幅。当前 UI 留了"🤖 自动获取数据"按钮（disabled），后端 ready 后启用。
- [ ] VIC / QLD 印花税
- [ ] 多场景对比模式
- [ ] 链接保存场景（URL 编码）
- [ ] 自住转投资期建模 + CGT 出口策略

## 本地开发

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # 产出 out/ 静态站点
npm run preview      # 本地预览构建结果（http://localhost:3000）
```

## 部署到 GitHub Pages

仓库已配置 GitHub Actions 自动部署：

1. GitHub 仓库 Settings → Pages → Source 选 **GitHub Actions**
2. 推送到 `main` 或 `claude/aus-deposit-loan-guide-BbfIl` 分支自动触发构建
3. 构建完成后访问 https://linwei94.github.io/aussie-house-buyer/

如果你 fork 这个仓库，把 `next.config.js` 里的 `repoName` 改成你自己的仓库名。

## 数据声明

- 利率与税率基于 2026 Q1 公开信息
- 仅供参考，不构成财务、法律或税务建议
- 实际签约前请咨询独立 mortgage broker、买家律师与会计师
