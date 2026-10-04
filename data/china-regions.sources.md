# 收货省市数据

本项目的 `china-regions.json` 用于收货省市选择和地区名称匹配，不代表商品支持这些地区办理。

- 数据项目：[modood/Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China)。
- 固定版本：[dc3a1d7acd85ca1b0979543e9259604142c52e8e](https://github.com/modood/Administrative-divisions-of-China/commit/dc3a1d7acd85ca1b0979543e9259604142c52e8e)，提交时间 2023-09-13；该版本 package.json 标识为 china-division 2.6.1。
- 原始文件：[dist/pca-code.json](https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/dc3a1d7acd85ca1b0979543e9259604142c52e8e/dist/pca-code.json)。原始字节 SHA-256：`83b7536f853ad16beb4d37b92890a3fd7bb9d33d4f37e7c8885fb948749a9bc4`。
- 统计口径：该版本 [README](https://github.com/modood/Administrative-divisions-of-China/blob/dc3a1d7acd85ca1b0979543e9259604142c52e8e/README.md) 标注来源为国家统计局 2023 年统计用区划和城乡划分代码，截止 2023-06-30，发布于 2023-09-11。提交说明残留“2022”字样，因此版本判断依据固定文件和 README，而非提交标题。
- 许可：固定版本的 [LICENSE](https://github.com/modood/Administrative-divisions-of-China/blob/dc3a1d7acd85ca1b0979543e9259604142c52e8e/LICENSE) 为 WTFPL 2.0；package.json 中的 MIT 标识与许可证正文不一致，此处按实际 LICENSE 文件记录。
- 更新边界：上游现已声明停止更新；这是明确版本的本地快照，不宣称为 2026 年最新行政区划。新增、更名或无法识别的旧链接地区继续显示待确认，不能据此判定商品可办。

## 转换规则

只保留中国大陆 31 个省级行政区及城市选择层，总计 369 个可选地区，无运行时下载和新增 npm 依赖。

1. 普通省份保留地级市、自治州、地区、盟，名称保持来源原文。
2. 北京、天津、上海、重庆直接提供同名直辖市选项，不把“市辖区”“县”作为城市。
3. 河南、湖北、海南、新疆的“省/自治区直辖县级行政区划”展开为实际单位，例如济源市、仙桃市、神农架林区、澄迈县、白杨市；不提供汇总占位名称。
4. 原省级两位编码补四个零、地级四位编码补两个零；直属县级六位编码保持原值。编码仅标识选项，不用于推断发货权限。
5. 省份值沿用现有链接中的简称（如“广东”“广西”），保留全称供识别。城市保存完整名称；只兼容有明确对应的去“市”后缀名称和原有七个英文城市 slug，不猜测未知别名。

更新时应固定新提交、核对原始文件 SHA-256，按上述规则重新生成 JSON，并运行地区覆盖、禁发边界和条件恢复测试。
