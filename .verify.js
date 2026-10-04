const fs = require("fs");
const vm = require("vm");
const path = "C:\\Users\\罗彬\\Desktop\\网站\\index.html";
const src = fs.readFileSync(path, "utf8");

const out = [];
const ok = (label, cond, extra) =>
  out.push(`${cond ? "  [OK]  " : "  [!!]  "}${label}${extra ? "  -> " + extra : ""}`);

// ---------- 1. 抽出所有 <script> 并做语法编译 ----------
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
out.push(`内联脚本数量: ${scripts.length}`);
let jsAllOk = true;
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `inline-${i + 1}.js` });
    out.push(`  [OK]  脚本 #${i + 1} (${code.trim().split("\n").length} 行) 语法通过`);
  } catch (e) {
    jsAllOk = false;
    out.push(`  [!!]  脚本 #${i + 1} 语法错误: ${e.message}`);
  }
});

// ---------- 2. CSS 括号平衡 ----------
const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
ok("CSS 花括号平衡", css.split("{").length === css.split("}").length,
   `${css.split("{").length - 1} 条规则`);

// ---------- 3. 标签配对 ----------
const VOID = new Set(["area","base","br","col","embed","hr","img","input","link",
                      "meta","param","source","track","wbr"]);
const body = src.replace(/<script>[\s\S]*?<\/script>/g, "")
                .replace(/<style>[\s\S]*?<\/style>/g, "")
                .replace(/<!--[\s\S]*?-->/g, "");
const stack = [];
const errs = [];
for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
  const [, close, tag, , selfClose] = m;
  if (VOID.has(tag.toLowerCase()) || selfClose === "/") continue;
  if (!close) stack.push(tag.toLowerCase());
  else {
    const top = stack.pop();
    if (top !== tag.toLowerCase()) errs.push(`<${top}> 被 </${tag}> 关闭`);
  }
}
ok("标签正确嵌套闭合", errs.length === 0 && stack.length === 0,
   errs.length || stack.length ? (errs.join("; ") || "未闭合: " + stack.join(",")) : "全部配对");

// ---------- 4. id 唯一性 & 锚点可达 ----------
const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
ok("id 唯一", dupIds.length === 0, dupIds.join(",") || `${ids.length} 个 id`);

const anchors = [...src.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
const broken = [...new Set(anchors)].filter((a) => !ids.includes(a));
ok("页内锚点都有对应元素", broken.length === 0,
   broken.length ? "断链: " + broken.join(",") : [...new Set(anchors)].join(", "));

// ---------- 5. 回到顶部专项 ----------
out.push("");
out.push("回到顶部专项:");
ok("存在悬浮按钮 .back-top", /class="back-top"/.test(src));
ok("按钮带 data-top 标记", /\bdata-top\b/.test(src));
ok("CSS 定义 .back-top 且默认隐藏",
   /\.back-top\s*\{[\s\S]*?visibility:\s*hidden/.test(css));
ok("CSS 定义 .is-visible 显示态", /\.back-top\.is-visible/.test(css));
ok("JS 监听滚动控制显隐", /classList\.toggle\("is-visible"/.test(src));
const jsLast = scripts[scripts.length - 1];
ok("点击处理识别 [data-top]", /\[data-top\]/.test(jsLast));
ok("置顶走 top = 0（绕开吸顶元素）", /var top = 0;/.test(jsLast));
ok("其它锚点按 header 实际高度算偏移",
   /header\.offsetHeight \+ 16/.test(jsLast));
ok("不再硬编码 84px 作为主路径", !/pageYOffset\s*-\s*84/.test(jsLast));

// ---------- 6. 邮箱一致性 ----------
out.push("");
out.push("内容一致性:");
const mails = [...new Set([...src.matchAll(/mailto:([^"']+)/g)].map((m) => m[1]))];
const shown = [...new Set([...src.matchAll(/class="mail"[^>]*>([^<]+)</g)].map((m) => m[1]))];
ok("mailto 目标与显示文本一致",
   shown.every((s) => mails.includes(s)),
   `链接=${mails.join(" / ")}  显示=${shown.join(" / ")}`);

console.log("=".repeat(62));
console.log("网站自检报告  " + path);
console.log("=".repeat(62));
console.log(out.join("\n"));
console.log("=".repeat(62));
console.log(`文件大小 ${Buffer.byteLength(src)} 字节 / ${src.split("\n").length} 行`);
console.log(`脚本语法整体: ${jsAllOk ? "全部通过 ✔" : "存在错误 ✘"}`);
