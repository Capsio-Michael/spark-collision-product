"""Build the editable local demo PPTX from text shapes and the site screenshot.

The presentation bundle requested by the slides skill was unavailable on this
Mac, so this uses the standard OOXML package format directly. No third-party
package is installed or required.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "spark-collision-demo-v2.pptx"
IMAGE = ROOT / "assets" / "homepage.png"
EMU = 9525
W, H = 1280 * EMU, 720 * EMU
BG, INK, MINT, CYAN, MUTED = "071624", "EAF1EC", "BDF36D", "7BD9D2", "A6B8BC"
FONT = "Hiragino Sans GB"


def tx(text, x, y, width, height, size, color=INK, bold=False, align="l"):
    tx.counter += 1
    n = tx.counter
    x, y, width, height = (round(v * EMU) for v in (x, y, width, height))
    size = round(size * 100)
    b = ' b="1"' if bold else ""
    return f'''<p:sp><p:nvSpPr><p:cNvPr id="{n}" name="Text {n}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{width}" cy="{height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
      <p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>
      <a:p><a:pPr algn="{align}"/><a:r><a:rPr lang="zh-CN" sz="{size}"{b}><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="Arial"/><a:ea typeface="{FONT}"/></a:rPr><a:t>{escape(text)}</a:t></a:r><a:endParaRPr lang="zh-CN"/></a:p></p:txBody></p:sp>'''


tx.counter = 1


def pic(x, y, width, height):
    x, y, width, height = (round(v * EMU) for v in (x, y, width, height))
    return f'''<p:pic><p:nvPicPr><p:cNvPr id="100" name="官网概念页截图"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
      <p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{width}" cy="{height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln><a:solidFill><a:srgbClr val="31515B"/></a:solidFill></a:ln></p:spPr></p:pic>'''


def slide(objects):
    tx.counter = 1
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="{BG}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    {''.join(objects)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'''


S = []
S.append(slide([
    tx("2026 上海 Hackathon · 概念演示", 70, 74, 800, 34, 18, CYAN, True),
    tx("智慧火花碰撞", 70, 205, 1100, 100, 76, INK, True),
    tx("对话结束，认知继续", 70, 316, 1100, 100, 69, MINT, True),
    tx("让分散的交流成为有依据、有条件、有历史的项目记忆", 73, 500, 1050, 60, 29, INK),
    tx("静态网页与合成案例 · 分析引擎尚在开发", 73, 627, 1000, 35, 18, MUTED),
]))
S.append(slide([
    tx("01 / 场景", 70, 65, 600, 30, 18, CYAN, True),
    tx("与 100 人交流之后，", 70, 145, 1120, 80, 59, INK, True),
    tx("我们究竟学到了什么？", 70, 228, 1120, 80, 59, MINT, True),
    tx("大家真正表达的关注点是什么", 72, 403, 1080, 55, 31, INK),
    tx("原因与分歧分别来自哪些原话", 72, 478, 1080, 55, 31, INK),
    tx("哪些判断因新讨论而改变了适用条件", 72, 553, 1080, 55, 31, INK),
    tx("“100 人”是产品使用情境示例，不代表现有用户数据", 72, 661, 1100, 24, 15, MUTED),
]))
S.append(slide([
    tx("02 / 工作方式", 70, 65, 650, 30, 18, CYAN, True),
    tx("让每次发言连接到智慧点", 70, 137, 1130, 65, 49, INK, True),
    tx("01  原话与来源", 75, 284, 380, 55, 34, MINT, True),
    tx("保留记录、发言人、段落定位", 75, 343, 1020, 45, 26, MUTED),
    tx("02  关系与条件", 75, 424, 380, 55, 34, MINT, True),
    tx("识别支持、质疑、反例、补充及适用场景", 75, 483, 1070, 45, 26, MUTED),
    tx("03  判断与版本", 75, 564, 380, 55, 34, MINT, True),
    tx("新信息修正认识；旧版本和证据仍可查看", 75, 623, 1090, 45, 26, MUTED),
]))
S.append(slide([
    tx("03 / 企业应用场景", 70, 65, 650, 30, 18, CYAN, True),
    tx("四类讨论，四种判断变化", 70, 135, 1120, 75, 51, INK, True),
    tx("销售报价", 72, 262, 230, 50, 30, MINT, True),
    tx("跨区与目录价的确认边界不同", 318, 265, 880, 46, 28, INK),
    tx("客户服务", 72, 350, 230, 50, 30, MINT, True),
    tx("未发货的小额取消需与其他退款分开核实", 318, 353, 890, 46, 27, INK),
    tx("制造质量", 72, 438, 230, 50, 30, MINT, True),
    tx("换班后和高温运行时都曾报告噪音，原因待验证", 318, 441, 890, 46, 27, INK),
    tx("员工入职", 72, 526, 230, 50, 30, MINT, True),
    tx("重复流程问题可试自助，角色判断仍需导师", 318, 529, 890, 46, 27, INK),
    tx("全部为合成场景，不代表客户结果或已批准的企业规则", 73, 664, 1100, 26, 16, MUTED),
]))
S.append(slide([
    tx("04 / 合成案例详解", 70, 65, 650, 30, 18, CYAN, True),
    tx("同一话题，不同条件", 70, 133, 1120, 75, 53, INK, True),
    tx("R1  “报价需要人工确认”", 73, 252, 1120, 50, 29, INK),
    tx("R2  “跨区报价需要销售确认”", 73, 329, 1120, 50, 29, INK),
    tx("R3  “目录价且无折扣，可直接发送”", 73, 406, 1120, 50, 29, INK),
    tx("判断变化", 73, 524, 320, 45, 24, CYAN, True),
    tx("版本 01：报价需人工确认，范围待核实", 73, 569, 1120, 40, 24, MUTED),
    tx("版本 02：跨区与目录价分别适用不同处理方式", 73, 617, 1120, 40, 24, MINT, True),
    tx("所有发言均为合成材料；观点不等于事实或行动批准", 73, 675, 1100, 23, 15, MUTED),
]))
S.append(slide([
    tx("05 / 页面演示", 70, 54, 650, 30, 18, CYAN, True),
    tx("点击原话，观察判断变化", 70, 100, 1100, 65, 46, INK, True),
    pic(70, 187, 970, 478),
    tx("合成案例", 1062, 235, 175, 37, 22, MINT, True),
    tx("加入第 3 段", 1062, 320, 185, 35, 20, INK),
    tx("查看条件限定", 1062, 364, 185, 35, 20, INK),
    tx("点开原话", 1062, 450, 185, 35, 20, INK),
    tx("保留旧版本", 1062, 494, 185, 35, 20, INK),
    tx("网页仅为静态交互原型，不连接分析服务", 70, 679, 1110, 22, 15, MUTED),
]))
S.append(slide([
    tx("06 / 今天的范围", 70, 65, 650, 30, 18, CYAN, True),
    tx("一个项目，3–5 份短记录", 70, 142, 1130, 76, 56, INK, True),
    tx("首页显示关注点与判断变化；详情可点回原话", 73, 267, 1120, 50, 29, INK),
    tx("新讨论可修正旧认识，不抹掉历史", 73, 345, 1120, 50, 29, INK),
    tx("重复信息可以增加覆盖，但不制造新火花", 73, 423, 1120, 50, 29, INK),
    tx("真实 MVP 还需本地持久化与可阅读导出", 73, 501, 1120, 50, 29, INK),
    tx("当前交付：官网概念页 + 路演 PPT", 73, 603, 1120, 45, 26, MINT, True),
    tx("无音频转写、OCR、多人权限、企业集成或外部任务自动执行", 73, 670, 1120, 25, 16, MUTED),
]))


def rels(items):
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{kind}" Target="{target}"/>' for rid, kind, target in items) + '</Relationships>'


CONTENT = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>''' + ''.join(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(1, len(S) + 1)) + '''</Types>'''
PRES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{''.join(f'<p:sldId id="{256+i}" r:id="rId{i+2}"/>' for i in range(len(S)))}</p:sldIdLst><p:sldSz cx="{W}" cy="{H}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'''
GROUP = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>'
MASTER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>{GROUP}</p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'''
LAYOUT = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank">{GROUP}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'''
THEME = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Spark Collision"><a:themeElements><a:clrScheme name="Spark"><a:dk1><a:srgbClr val="071624"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0D2330"/></a:dk2><a:lt2><a:srgbClr val="F3F2E9"/></a:lt2><a:accent1><a:srgbClr val="BDF36D"/></a:accent1><a:accent2><a:srgbClr val="7BD9D2"/></a:accent2><a:accent3><a:srgbClr val="A6B8BC"/></a:accent3><a:accent4><a:srgbClr val="347C70"/></a:accent4><a:accent5><a:srgbClr val="EAF1EC"/></a:accent5><a:accent6><a:srgbClr val="31515B"/></a:accent6><a:hlink><a:srgbClr val="7BD9D2"/></a:hlink><a:folHlink><a:srgbClr val="347C70"/></a:folHlink></a:clrScheme><a:fontScheme name="Spark"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Hiragino Sans GB"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Hiragino Sans GB"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Spark"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="dk1"/></a:solidFill><a:solidFill><a:schemeClr val="dk2"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'''


with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", CONTENT)
    z.writestr("_rels/.rels", rels([("rId1", "officeDocument", "ppt/presentation.xml")]))
    z.writestr("ppt/presentation.xml", PRES)
    z.writestr("ppt/_rels/presentation.xml.rels", rels([("rId1", "slideMaster", "slideMasters/slideMaster1.xml")] + [(f"rId{i+2}", "slide", f"slides/slide{i+1}.xml") for i in range(len(S))]))
    z.writestr("ppt/slideMasters/slideMaster1.xml", MASTER)
    z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"), ("rId2", "theme", "../theme/theme1.xml")]))
    z.writestr("ppt/slideLayouts/slideLayout1.xml", LAYOUT)
    z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels([("rId1", "slideMaster", "../slideMasters/slideMaster1.xml")]))
    z.writestr("ppt/theme/theme1.xml", THEME)
    for i, content in enumerate(S, 1):
        z.writestr(f"ppt/slides/slide{i}.xml", content)
        relationships = [("rId1", "slideLayout", "../slideLayouts/slideLayout1.xml")]
        if i == 6:
            relationships.append(("rId2", "image", "../media/homepage.png"))
        z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", rels(relationships))
    z.write(IMAGE, "ppt/media/homepage.png")

print(OUT)
