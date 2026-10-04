import re
from html.parser import HTMLParser

V = {"area","base","br","col","embed","hr","img","input","link","meta",
     "param","source","track","wbr"}

class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors = [], []
        self.ids, self.hrefs = {}, []
        self.classes, self.raw = set(), []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        self.raw.append((tag, d))
        if "id" in d:
            self.ids[d["id"]] = self.ids.get(d["id"], 0) + 1
        if "href" in d:
            self.hrefs.append(d["href"])
        if "class" in d:
            self.classes.update(d["class"].split())
        if tag in ("script", "style"):
            self.skip += 1
        if tag not in V:
            self.stack.append((tag, self.getpos()))
    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag in V:
            return
        if not self.stack:
            self.errors.append("stray </%s> at %s" % (tag, self.getpos()))
            return
        top, pos = self.stack.pop()
        if top != tag:
            self.errors.append("<%s>@%s closed by </%s>@%s"
                               % (top, pos, tag, self.getpos()))

p = r"C:\Users\罗彬\Desktop\网站\index.html"
src = open(p, encoding="utf-8").read()
c = Check(); c.feed(src); c.close()

print("=" * 58)
print("HTML 结构校验 — index.html")
print("=" * 58)
print("标签闭合  :", "OK" if not c.errors and not c.stack else "有问题")
for e in c.errors:
    print("   ", e)
for t, pos in c.stack:
    print("    未闭合 <%s> @%s" % (t, pos))

dup = {k: v for k, v in c.ids.items() if v > 1}
print("id 唯一性 :", "OK" if not dup else "重复 -> %s" % dup)

frag = sorted({h[1:] for h in c.hrefs if h.startswith("#") and len(h) > 1})
missing = [f for f in frag if f not in c.ids]
print("锚点链接  :", ", ".join(frag))
print("空锚点    :", missing if missing else "无（全部有对应元素）")

css = "\n".join(re.findall(r"<style>(.*?)</style>", src, re.S))
js = "\n".join(re.findall(r"<script>(.*?)</script>", src, re.S))
defined = set(re.findall(r"\.([A-Za-z][\w-]*)", css))
undef = sorted(x for x in c.classes if x not in defined)
print("未定义类  :", undef if undef else "无")
for x in sorted(set(re.findall(r"classList\.(?:add|remove|toggle)\(\s*\"([\w-]+)\"", js))):
    if x not in defined:
        print("    JS 用到但 CSS 未定义:", x)

print("CSS 括号  :", "平衡" if css.count("{") == css.count("}") else "不平衡")
for name, (o, cl) in {"圆括号 ()": "()", "花括号 {}": "{}", "方括号 []": "[]"}.items():
    print("JS %-10s: %s (%d/%d)" % (name, "平衡" if js.count(o) == js.count(cl)
                                    else "不平衡!", js.count(o), js.count(cl)))

# 回到顶部相关
print("-" * 58)
print("回到顶部检查")
print("  悬浮按钮 .back-top      :", "有" if 'class="back-top"' in src else "无")
print("  data-top 标记           :", "有" if "data-top" in src else "无")
print("  联系区 #back-to-top     :", "有" if 'id="back-to-top"' in src else "无")
print("  样式 .back-top          :", "有" if ".back-top {" in css else "无")
print("  JS 识别 data-top        :", "有" if 'hasAttribute("data-top")' in src else "无")
print("  滚到 0 的分支           :", "有" if "var top = 0;" in js else "无")
print("  不再依赖 #top 定位      :",
      "是" if "isTop = link.hasAttribute" in js else "否")
print("  硬编码偏移 84           :",
      "仅作无 header 时的兜底" if "- 84" in js or "+ 16 : 84" in js else "已移除")
print("-" * 58)
print("文件: %d 字节 / %d 行" % (len(src.encode("utf-8")), src.count("\n") + 1))
